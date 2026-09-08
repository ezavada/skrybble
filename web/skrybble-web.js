(function() {
    'use strict';

    var statusNode = document.getElementById('status');
    var canvas = document.getElementById('pdg-canvas');
    var moduleCache = Object.create(null);
    var builtins = Object.create(null);
    var uploadSequence = 0;

    // Native browser menus interrupt GLFW's mouse sequence and take keyboard
    // focus away from the drawing surface. Skrybble uses right-click itself to
    // finish multi-point shapes, so keep that gesture inside the application.
    canvas.addEventListener('mousedown', function() {
        canvas.focus({ preventScroll: true });
    }, true);
    canvas.addEventListener('contextmenu', function(event) {
        event.preventDefault();
        canvas.focus({ preventScroll: true });
    });

    function fail(error) {
        var message = error && error.stack ? error.stack : String(error);
        console.error(message);
        document.documentElement.setAttribute('data-status', 'failed');
        statusNode.textContent = 'Skrybble failed to start — see the console for details.';
    }

    function bytesToBase64(bytes) {
        var result = '';
        var chunkSize = 0x8000;
        for (var offset = 0; offset < bytes.length; offset += chunkSize) {
            result += String.fromCharCode.apply(null, bytes.subarray(offset, offset + chunkSize));
        }
        return btoa(result);
    }

    function base64ToBytes(value) {
        var binary = atob(value);
        var bytes = new Uint8Array(binary.length);
        for (var index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
        return bytes;
    }

    function browserBuffer(value) {
        var bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
        bytes.toString = function(encoding) {
            if (encoding === 'base64') return bytesToBase64(bytes);
            return new TextDecoder().decode(bytes);
        };
        return bytes;
    }

    function normalizePath(value) {
        var parts = String(value || '').replace(/\\/g, '/').split('/');
        var output = [];
        parts.forEach(function(part) {
            if (!part || part === '.') return;
            if (part === '..') output.pop();
            else output.push(part);
        });
        return '/' + output.join('/');
    }

    var pathModule = {
        basename: function(value) { return normalizePath(value).split('/').pop(); },
        dirname: function(value) {
            var normalized = normalizePath(value);
            return normalized.slice(0, normalized.lastIndexOf('/')) || '/';
        },
        extname: function(value) {
            var name = pathModule.basename(value);
            var dot = name.lastIndexOf('.');
            return dot > 0 ? name.slice(dot) : '';
        },
        join: function() { return normalizePath(Array.prototype.join.call(arguments, '/')); },
        resolve: function() { return normalizePath(Array.prototype.join.call(arguments, '/')); }
    };

    function installBuiltins() {
        builtins.pdg = window.pdg;
        builtins.path = pathModule;
        builtins.os = { tmpdir: function() { return '/tmp'; } };
        builtins.child_process = {
            execFileSync: function() { throw new Error('Native processes are unavailable in a browser'); }
        };
        builtins.fs = {
            existsSync: function(filename) { return window.FS.analyzePath(normalizePath(filename)).exists; },
            mkdirSync: function(filename) { window.FS.mkdirTree(normalizePath(filename)); },
            readFileSync: function(filename, encoding) {
                var options = encoding ? { encoding: encoding } : undefined;
                var data = window.FS.readFile(normalizePath(filename), options);
                return encoding ? data : browserBuffer(data);
            },
            writeFileSync: function(filename, data, encoding) {
                var normalized = normalizePath(filename);
                window.FS.mkdirTree(pathModule.dirname(normalized));
                window.FS.writeFile(normalized, data, encoding ? { encoding: encoding } : undefined);
            }
        };
        builtins.crypto = {
            createHash: function() {
                var hash = 2166136261;
                return {
                    update: function(value) {
                        var text = String(value);
                        for (var index = 0; index < text.length; index++) {
                            hash ^= text.charCodeAt(index);
                            hash = Math.imul(hash, 16777619);
                        }
                        return this;
                    },
                    digest: function() { return (hash >>> 0).toString(16).padStart(8, '0'); }
                };
            }
        };
        window.Buffer = { from: function(value, encoding) {
            return browserBuffer(encoding === 'base64' ? base64ToBytes(value) : new TextEncoder().encode(value));
        } };
    }

    function requestSource(url) {
        var request = new XMLHttpRequest();
        request.open('GET', url, false);
        request.send(null);
        if (request.status >= 200 && request.status < 300) return request.responseText;
        throw new Error('Could not load ' + url + ' (HTTP ' + request.status + ')');
    }

    function resolveModule(request, parentUrl) {
        var resolved = new URL(request, parentUrl).href;
        var pathname = new URL(resolved).pathname;
        var candidates = /\.[^/]+$/.test(pathname)
            ? [resolved]
            : [resolved + '.js', resolved.replace(/\/$/, '') + '/index.js'];
        for (var index = 0; index < candidates.length; index++) {
            try { return { url: candidates[index], source: requestSource(candidates[index]) }; }
            catch (error) {}
        }
        throw new Error('Cannot load module ' + request + ' from ' + parentUrl);
    }

    function browserRequire(request, parentUrl) {
        if (Object.prototype.hasOwnProperty.call(builtins, request)) return builtins[request];
        if (request.charAt(0) !== '.' && request.charAt(0) !== '/') {
            throw new Error('Unsupported browser module: ' + request);
        }
        var loaded = resolveModule(request, parentUrl);
        if (moduleCache[loaded.url]) return moduleCache[loaded.url].exports;
        var module = { exports: {} };
        moduleCache[loaded.url] = module;
        var localRequire = function(name) { return browserRequire(name, loaded.url); };
        try {
            var factory = new Function('require', 'module', 'exports', '__filename', '__dirname',
                loaded.source + '\n//# sourceURL=' + loaded.url);
            factory(localRequire, module, module.exports, loaded.url,
                loaded.url.replace(/\/[^/]*$/, ''));
        } catch (error) {
            delete moduleCache[loaded.url];
            throw error;
        }
        return module.exports;
    }

    window.skrybbleWeb = {
        chooseFile: function(options) {
            return new Promise(function(resolve, reject) {
                var input = document.createElement('input');
                input.type = 'file';
                input.accept = options.accept || '';
                input.setAttribute('aria-label', options.prompt || 'Choose a file');
                input.addEventListener('change', function() {
                    var file = input.files && input.files[0];
                    if (!file) { resolve(''); return; }
                    file.arrayBuffer().then(function(buffer) {
                        var safeName = file.name.replace(/[^A-Za-z0-9._-]/g, '_');
                        var filename = '/uploads/' + (++uploadSequence) + '-' + safeName;
                        window.FS.mkdirTree('/uploads');
                        window.FS.writeFile(filename, new Uint8Array(buffer));
                        resolve(filename);
                    }, reject);
                }, { once: true });
                input.click();
            });
        },
        downloadFile: function(filename, contents, contentType) {
            var blob = new Blob([contents], { type: contentType || 'application/octet-stream' });
            var url = URL.createObjectURL(blob);
            var anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = pathModule.basename(filename);
            anchor.click();
            setTimeout(function() { URL.revokeObjectURL(url); }, 0);
        }
    };

    function start() {
        installBuiltins();
        window.process.argv = ['pdg', 'main.js'];
        window.process.platform = 'browser';
        window.process.exit = function(code) {
            if (code) throw new Error('Skrybble exited with status ' + code);
        };
        browserRequire('./main.js', new URL('./', window.location.href).href);
        document.documentElement.setAttribute('data-status', 'ready');
        statusNode.remove();
        canvas.focus({ preventScroll: true });
    }

    function waitForPdg(deadline) {
        if (window.pdg && window.pdg.pdgReady) {
            try { start(); } catch (error) { fail(error); }
        } else if (Date.now() > deadline) {
            fail(new Error('PDG WebAssembly initialization timed out'));
        } else {
            setTimeout(function() { waitForPdg(deadline); }, 25);
        }
    }

    var script = document.createElement('script');
    script.src = 'libpdg.js';
    script.onerror = function() { fail(new Error('libpdg.js failed to load')); };
    document.head.appendChild(script);
    waitForPdg(Date.now() + 30000);
})();

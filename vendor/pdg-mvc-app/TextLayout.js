// Width-based layout. Offsets are UTF-16 indices; breaks never split surrogate pairs.
function layoutText(text, width, wrap, measure) {
    const lines = [];
    if (!text) return lines;
    const breaks = /\r\n|[\r\n]/g;
    let start = 0;
    const emit = (from, to) => {
        const value = text.slice(from, to);
        const offsets = [from], advances = [0];
        let offset = from;
        for (const character of value) {
            offset += character.length;
            offsets.push(offset);
            advances.push(measure(text.slice(from, offset)));
        }
        lines.push({ text: value, start: from, end: to,
            width: advances[advances.length - 1], offsets, advances });
    };
    const paragraph = (from, to) => {
        if (!wrap || from === to) { emit(from, to); return; }
        while (from < to) {
            let end = from, breakAt = -1;
            for (const character of text.slice(from, to)) {
                const next = end + character.length;
                const measured = measure(text.slice(from, next));
                if (measured > width && end > from) break;
                end = next;
                if (character === ' ' || character === '\t') breakAt = end;
                if (measured > width) break;
            }
            if (end < to && breakAt > from) end = breakAt;
            let trimmed = end;
            if (end < to) while (trimmed > from && /[ \t]/.test(text[trimmed - 1])) --trimmed;
            emit(from, trimmed);
            from = end;
            if (from < to) while (from < to && /[ \t]/.test(text[from])) ++from;
        }
    };
    let match;
    while ((match = breaks.exec(text))) {
        paragraph(start, match.index);
        start = match.index + match[0].length;
    }
    paragraph(start, text.length);
    return lines;
}

// Embind may return distinct handles for the same native Font.
function sameFont(first, second) {
    return first === second || !!(first && second && typeof first.isAliasOf === 'function' && first.isAliasOf(second));
}

module.exports = { layoutText, sameFont };

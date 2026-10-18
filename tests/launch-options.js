// Run with node tests/launch-options.js.
const assert=require('assert'),path=require('path');
const parse=require('../launch-options');
let options=parse(['pdg','main.js','--input','pose with spaces.ink.svg','--output=result.pdgdrawing','--convert-curves']);
assert.strictEqual(options.input,path.resolve('pose with spaces.ink.svg'));
assert.strictEqual(options.output,path.resolve('result.pdgdrawing'));
assert.strictEqual(options.convertCurves,true);
assert.strictEqual(parse(['pdg','main.js','pose.svg']).input,path.resolve('pose.svg'));
assert.strictEqual(parse(['--output','new.skrbl']).input,null);
for(const args of [['--input'],['--output='],['--output','bad.svg'],['--convert-curves'],['--input','a.svg','--input','b.svg'],['--input','a.svg','b.svg'],['--input','a.pdgdrawing','--output','a.pdgdrawing','--convert-curves'],['--unknown']])
 assert.throws(()=>parse(args),undefined,JSON.stringify(args));
console.log('PASS launch options, compatibility, spaces, validation, and source protection');

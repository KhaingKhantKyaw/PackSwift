import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyAdvisory} from '../src/services/travel-advisory.js';
test('advisory classes preserve regional scope and never imply safety',()=>{
  assert.equal(classifyAdvisory(['avoid_all_travel']).severity,'critical');
  assert.match(classifyAdvisory(['avoid_all_travel_to_parts']).message,/regional/);
  assert.equal(classifyAdvisory(['avoid_all_but_essential_travel_to_parts']).severity,'caution');
  assert.equal(classifyAdvisory(undefined).severity,'unknown');
  assert.equal(classifyAdvisory(['new_status']).severity,'unknown');
  assert.match(classifyAdvisory([]).message,/does not mean/);
});

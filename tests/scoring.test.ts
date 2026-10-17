import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateScores,DIMENSIONS,getTier,validateThresholds} from '../src/lib/scoring';
const answers=Object.fromEntries(DIMENSIONS.flatMap(d=>d.questionIds.map(q=>[q,3])));
test('catalog: 35 attributes, 5 dimensions, weights total 1',()=>{
 assert.equal(DIMENSIONS.reduce((n,d)=>n+d.questionIds.length,0),35);
 assert.equal(DIMENSIONS.reduce((n,d)=>n+d.weight,0),1);
});
test('all 3s yield exactly 3, baseline ignored',()=>{assert.equal(calculateScores({...answers,q1:5,q2:1}).total,3);});
test('test vector yields 3.135 (using per-dimension uniform scores for synthetic vector)',()=>{
 const arrs=[[3,4,2,3,4,5],[3,3,3,3,3,3,3],[4,4,4,4,4,4,4],[2,2,2,2,2,2,2],[2,3,2,3,2,3,2,3]];
 const example=Object.fromEntries(DIMENSIONS.flatMap((d,i)=>d.questionIds.map((id,j)=>[id,arrs[i][j]])));
 assert.ok(Math.abs(calculateScores(example).total-3.135)<1e-10);
});
test('1 and 5 boundaries',()=>{
 assert.equal(calculateScores(Object.fromEntries(Object.keys(answers).map(k=>[k,1]))).total,1);
 assert.equal(calculateScores(Object.fromEntries(Object.keys(answers).map(k=>[k,5]))).total,5);
});
test('incomplete questionnaire cannot be scored',()=>{assert.throws(()=>calculateScores({...answers,q3:undefined as unknown as number}));});
test('tier disabled without sourced rules',()=>{assert.equal(getTier(3.5,[]),null);});
test('approved tier gaps rejected',()=>{
 assert.equal(validateThresholds([{tier:'Tier 1',min:1,max:2},{tier:'Tier 2',min:2,max:3},{tier:'Tier 3',min:3,max:4},{tier:'Tier 4',min:4,max:4.5},{tier:'Tier 5',min:4.6,max:5}]),false);
});

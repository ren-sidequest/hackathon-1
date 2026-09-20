import { beforeEach, expect, it, vi } from 'vitest';
import { readRoleView, saveRoleView, roleDestination, roleLink } from '../../shared/role-navigation';
import type { Demo } from '../../shared/api4-types';

const demo = { schemaVersion:'4.0',sessionId:'session',fixtureVersion:'fixture',jdVersion:'jd',rubricVersion:'rubric',datasetVersion:'dataset',candidate:{id:'amy-chen'},task:{taskId:'task',status:'sent'},currentSubmissionVersion:null } as unknown as Demo;
beforeEach(() => { const storage = new Map(); vi.stubGlobal('sessionStorage', { getItem:(key:string)=>storage.get(key) ?? null, setItem:(key:string,value:string)=>storage.set(key,value) }); });
it('links between deployed folders with only explicit navigation and presentation fields', () => {
  const link = new URL(roleLink(roleDestination('candidate','https://example.test/hr/?secret=not-transferred#evidence'),'candidate',demo,true,'light'));
  expect(link.pathname).toBe('/candidate/'); expect(link.hash).toBe('#tasks');
  expect(Object.fromEntries(link.searchParams)).toEqual({candidateId:'amy-chen',_ebRole:'candidate',_ebTheme:'light',_ebSidebar:'collapsed'});
});
it('selects material or review destinations from current workflow without writing it', () => {
  expect(new URL(roleLink(new URL('https://example.test/candidate/'),'candidate',{...demo,task:{...demo.task,status:'draft'}},false,'dark')).hash).toBe('#application');
  expect(new URL(roleLink(new URL('https://example.test/hr/'),'hr',{...demo,currentSubmissionVersion:1},false,'dark')).hash).toBe('#tasks');
});
it('rejects external redirects, credentials and executable URLs', () => {
  for(const value of ['https://evil.test/','javascript:alert(1)','https://user:pass@example.test/hr/']) expect(()=>roleDestination('hr','https://example.test/candidate/',value)).toThrow();
  expect(()=>roleDestination('hr','https://example.test/candidate/','http://127.0.0.1:5186/',true)).toThrow();
});
it('permits an explicitly configured loopback peer only in development', () => {
  expect(roleDestination('hr','http://127.0.0.1:5173/','http://127.0.0.1:5186/',true).port).toBe('5186');
  expect(()=>roleDestination('hr','http://127.0.0.1:5173/','http://127.0.0.1:5186/',false)).toThrow();
});
it('isolates return locations by person, session, content and task', () => {
  saveRoleView(demo,'hr.page',{page:'evidence',scroll:500,criterion:'D2'});
  expect(readRoleView(demo,'hr.page').criterion).toBe('D2');
  for(const changed of [{...demo,sessionId:'new'},{...demo,jdVersion:'new'},{...demo,candidate:{id:'ann-li'}},{...demo,task:{taskId:'new'}}]) expect(readRoleView(changed as Demo,'hr.page').page).toBeUndefined();
  expect(readRoleView(demo,'candidate.page').page).toBeUndefined();
});
it('validates presentation fields and tolerates unavailable storage', () => {
  saveRoleView(demo,'hr.page',{criterion:'invalid',scroll:-20,stage:'fake',section:'fake'});
  expect(readRoleView(demo,'hr.page')).toMatchObject({criterion:undefined,scroll:0,stage:undefined,section:undefined});
  vi.stubGlobal('sessionStorage', { getItem:()=>{throw new Error('blocked');},setItem:()=>{throw new Error('blocked');} });
  expect(()=>saveRoleView(demo,'hr.page',{page:'evidence'})).not.toThrow(); expect(readRoleView(demo,'hr.page')).toEqual({});
});

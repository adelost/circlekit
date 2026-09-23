import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseLiveConnectArgs, stageLiveAndroid } from '../lib/live-connect.mjs';
import { createServer } from '../server.mjs';

const serial='emulator-5554';
const devices=`List of devices attached\n${serial} device product:wear\n`;
const input={device:serial,port:17317,product:'skyvw'};
const ticket='A'.repeat(43);

function fakeAdb({deviceList=devices,reverseList='',debug=true,failTicket=false,failStart=false,rebindOnFailure=false}={}) {
  const calls=[];let mapping=reverseList;
  const adb=async(args,stdin)=>{
    calls.push({args,stdin});
    if(args[0]==='devices')return {code:0,stdout:deviceList,stderr:''};
    if(args.includes('reverse')&&args.includes('--list'))return {code:0,stdout:mapping,stderr:''};
    if(args.includes('reverse')&&args.includes('--remove')){mapping='';return {code:0,stdout:'',stderr:''};}
    if(args.includes('reverse')){mapping='host-17 tcp:17317 tcp:17317\n';return {code:0,stdout:'',stderr:''};}
    if(args.includes('run-as')&&args.at(-1)==='id')return {code:debug?0:1,stdout:debug?'uid=10123(app)':'',stderr:''};
    if(args.includes('run-as'))return {code:failTicket?1:0,stdout:'',stderr:failTicket?'write refused':''};
    if(failStart&&rebindOnFailure)mapping='host-17 tcp:17317 tcp:9999\n';
    return {code:failStart?1:0,stdout:failStart?'':'Broadcast completed',stderr:''};
  };
  return {adb,calls};
}

test('A34 requires an exact serial and never picks among multiple devices',async()=>{
  assert.throws(()=>parseLiveConnectArgs([]),error=>error.code==='live.device');
  assert.throws(()=>parseLiveConnectArgs(['--device','bad serial']),error=>error.code==='live.device');
  const fixture=fakeAdb({deviceList:devices+'USB-2 device product:phone\n'});
  await assert.rejects(stageLiveAndroid(input,{adb:fixture.adb,issueTicket:async()=> 'secret',cwd:'/repo'}),
    error=>error.code==='live.device-count');
  assert.equal(fixture.calls.length,1);
});

test('A34 refuses a pre-existing reverse mapping without obtaining a ticket',async()=>{
  const fixture=fakeAdb({reverseList:`${serial} tcp:17317 tcp:9999\n`});let tickets=0;
  await assert.rejects(stageLiveAndroid(input,{adb:fixture.adb,issueTicket:async()=>{tickets++;return 'secret';},cwd:'/repo'}),
    error=>error.code==='live.reverse-owned');
  assert.equal(tickets,0);
  assert.equal(fixture.calls.filter(call=>call.args.includes('--remove')).length,0);
});

test('non-debug app refuses before reverse or ticket and names the install command',async()=>{
  const fixture=fakeAdb({debug:false});let tickets=0;
  await assert.rejects(stageLiveAndroid(input,{adb:fixture.adb,issueTicket:async()=>{tickets++;return 'secret';},cwd:'/repo'}),
    error=>error.code==='live.debug-app'&&error.message.includes('ANDROID_SERIAL=emulator-5554 ./gradlew :app:installDebug'));
  assert.equal(tickets,0);
  assert.equal(fixture.calls.filter(call=>call.args.includes('reverse')&&!call.args.includes('--list')).length,0);
});

test('ticket travels only via run-as stdin; a failed write removes only our new mapping',async()=>{
  const fixture=fakeAdb();
  const receipt=await stageLiveAndroid(input,{adb:fixture.adb,issueTicket:async()=> ticket,cwd:'/repo'});
  assert.equal(receipt.device,serial);
  const written=fixture.calls.find(call=>call.stdin);
  assert.ok(written.stdin.includes(ticket));
  assert.ok(written.args.includes('run-as'));
  assert.ok(fixture.calls.some(call=>call.args.includes('reverse')&&call.args.includes('--no-rebind')),
    'the final adb operation must refuse a mapping created after --list');
  assert.ok(written.stdin.includes('files/studio-observation/ticket'));
  assert.ok(fixture.calls.some(call=>call.args.includes('com.adelost.skydivealtimeter.STUDIO_OBSERVE')));
  assert.ok(fixture.calls.every(call=>!call.args.some(arg=>arg.includes(ticket))));
  const broken=fakeAdb({failTicket:true});
  await assert.rejects(stageLiveAndroid(input,{adb:broken.adb,issueTicket:async()=> ticket,cwd:'/repo'}),error=>error.code==='live.ticket-write');
  assert.equal(broken.calls.filter(call=>call.args.includes('--remove')).length,1);
  const noReceiver=fakeAdb({failStart:true});
  await assert.rejects(stageLiveAndroid(input,{adb:noReceiver.adb,issueTicket:async()=> ticket,cwd:'/repo'}),error=>error.code==='live.start');
  assert.ok(noReceiver.calls.some(call=>call.args.includes('rm')&&call.args.includes('files/studio-observation/ticket')));
  assert.equal(noReceiver.calls.filter(call=>call.args.includes('--remove')).length,1);
  const changed=fakeAdb({failStart:true,rebindOnFailure:true});
  await assert.rejects(stageLiveAndroid(input,{adb:changed.adb,issueTicket:async()=> ticket,cwd:'/repo'}),error=>error.code==='live.cleanup');
  assert.equal(changed.calls.filter(call=>call.args.includes('--remove')).length,0,'never remove a rebound mapping');
});

test('explicit connect stages a real Studio native ticket without exposing it in adb arguments',async t=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'studio-connect-'));
  const running=await createServer({port:0,dataDir:root,liveEnabled:true});
  t.after(async()=>{running.server.closeAllConnections();await new Promise(resolve=>running.server.close(resolve));await rm(root,{recursive:true,force:true});});
  const fixture=fakeAdb(),port=Number(new URL(running.origin).port);
  const receipt=await stageLiveAndroid({device:serial,port,product:'skyvw'}, {adb:fixture.adb,cwd:'/repo'}).catch(error=>{
    if(error.code==='live.product')return error;throw error;
  });
  assert.equal(receipt.code,'live.product','the example receiver is not SKYVW and cannot be paired as one');
  assert.ok(fixture.calls.every(call=>!call.stdin));
});

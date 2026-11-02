/* Sales Intelligence archive connection. GitHub hosts every UI element. */
'use strict';
(()=>{
const el=id=>document.getElementById(id);
const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
const configured=()=>{const value=window.SALES_INTELLIGENCE_APPS_SCRIPT_URL;if(!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(value||''))throw Error('Apps Script URL is not configured in index.html.');return value;};
let activeFile=null,reportItems=[],busy=false,lastParsedReport=null;
// Local workbook cache. Drive remains the source of truth; the cache only
// accelerates reopening the exact file version on the same browser/device.
const CACHE_DB='SalesIntelligenceReportCache', CACHE_STORE='workbooks';
let cacheDbPromise;
function cacheDb(){
  if(!('indexedDB' in window))return Promise.reject(Error('IndexedDB unavailable'));
  if(!cacheDbPromise)cacheDbPromise=new Promise((resolve,reject)=>{
    const req=indexedDB.open(CACHE_DB,1);
    req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(CACHE_STORE))db.createObjectStore(CACHE_STORE,{keyPath:'id'});};
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error||Error('Cache database unavailable'));
  });
  return cacheDbPromise;
}
async function cacheGet(id,bytes){
  try{
    const db=await cacheDb();
    const entry=await new Promise((resolve,reject)=>{const tx=db.transaction(CACHE_STORE,'readonly');const q=tx.objectStore(CACHE_STORE).get(id);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
    if(entry&&entry.bytes===bytes&&entry.buffer?.byteLength===bytes)return entry.buffer;
  }catch(e){console.warn('Report cache unavailable:',e);}
  return null;
}
async function cachePut(id,bytes,buffer){
  try{
    const db=await cacheDb();
    await new Promise((resolve,reject)=>{const tx=db.transaction(CACHE_STORE,'readwrite');tx.objectStore(CACHE_STORE).put({id,bytes,buffer,storedAt:Date.now()});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});
  }catch(e){console.warn('Unable to save local report cache:',e);}
}

function status(msg){el('archiveStatus').textContent=msg;}
function uploadStatus(msg){el('uploadStatus').textContent=msg;}
// The report library is a temporary view, not a reset of the loaded report.
let pageBeforeLibrary='overview';
function updateReturnButton(){
  let button=el('returnToDashboard');
  if(!button){
    button=document.createElement('button');
    button.id='returnToDashboard';
    button.type='button';
    button.className='primary';
    button.style.margin='0 0 18px';
    button.onclick=returnToDashboard;
    el('libraryLanding').prepend(button);
  }
  button.classList.toggle('hidden',!state.report);
  if(state.report)button.textContent='← Return to Dashboard · '+state.report.name;
}
function returnToDashboard(){
  if(!state.report)return;
  el('libraryLanding').classList.add('hidden');
  el('emptyState').classList.add('hidden');
  el('workspace').classList.remove('hidden');
  // Restore the active dashboard page without reloading or reprocessing the report.
  setPage(pageBeforeLibrary);
}
function showLibrary(){
  if(state.report && !el('workspace').classList.contains('hidden')) pageBeforeLibrary=state.page;
  el('libraryLanding').classList.remove('hidden');
  el('workspace').classList.add('hidden');
  el('emptyState').classList.add('hidden');
  el('pageTitle').textContent='Report Library';
  el('pageSub').textContent='Select a saved reporting month or upload a new workbook.';
  el('breadcrumb').textContent='REPORT ARCHIVE';
  updateReturnButton();
  // Refresh the report list without discarding the active dashboard.
  refresh().catch(err=>{status(err.message);showDiagnostics();});
}
function apiGet(action,params={}){
  // Google Apps Script ContentService supports JSONP, not ordinary cross-origin fetch.
  // A fresh callback and cache-buster are created for each request.
  return new Promise((resolve,reject)=>{
    const cb='siCb_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2);
    const script=document.createElement('script');let settled=false;
    let timer;
    const clean=()=>{clearTimeout(timer);script.remove();try{delete window[cb]}catch(e){window[cb]=undefined}};
    const done=(error,value)=>{if(settled)return;settled=true;clean();error?reject(error):resolve(value)};
    window[cb]=response=>{
      if(response?.ok)done(null,response.data);
      else done(new Error(response?.error||'Apps Script returned an unsuccessful result'));
    };
    script.onerror=()=>done(new Error('Apps Script JSONP script failed to load. Open the Diagnostics link to check the callback response and deployment access.'));
    const url=new URL(configured());url.searchParams.set('action',action);
    url.searchParams.set('callback',cb);url.searchParams.set('_t',String(Date.now()));
    Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,String(v)));
    script.src=url.toString();document.head.append(script);
    timer=setTimeout(()=>done(new Error('Apps Script did not execute the JSONP callback within 25 seconds. Check the browser Console for CSP or blocked script errors.')),25000);
  });
}
async function apiPost(fields){
  // A cross-origin form POST cannot reliably communicate back to GitHub via
  // iframe postMessage. Apps Script records a result under a one-time token;
  // the client retrieves it using the existing JSONP GET transport.
  const token='si_'+Math.random().toString(36).slice(2)+Date.now().toString(36);
  const iframe=document.createElement('iframe'),form=document.createElement('form');
  iframe.name='frame_'+token;
  iframe.hidden=true;
  form.method='POST';
  form.action=configured();
  form.target=iframe.name;
  form.style.display='none';
  for(const [k,v] of Object.entries({...fields,token})){
    const input=document.createElement('input');
    input.type='hidden';input.name=k;input.value=String(v);form.appendChild(input);
  }
  document.body.append(iframe,form);
  try{
    form.submit();
    const started=Date.now();
    while(Date.now()-started<90000){
      await new Promise(resolve=>setTimeout(resolve,700));
      try{
        const receipt=await apiGet('receipt',{token});
        if(receipt?.pending)continue;
        if(!receipt || typeof receipt.ok !== 'boolean') throw Error('Invalid backend receipt response.');
        if(!receipt.ok) throw Error(receipt.error || 'Apps Script operation failed');
        return receipt.data;
      }catch(err){
        // The GET transport may fail transiently while Google is processing.
        if(Date.now()-started>75000)throw err;
      }
    }
    throw Error('Backend did not confirm this request. Check Apps Script deployment and execution logs.');
  }finally{form.remove();iframe.remove()}
}
function toB64(bytes){let s='',chunk=16384;for(let i=0;i<bytes.length;i+=chunk)s+=String.fromCharCode(...bytes.subarray(i,i+chunk));return btoa(s)}
function decode64(b64){let raw=atob(b64),a=new Uint8Array(raw.length);for(let i=0;i<a.length;i++)a[i]=raw.charCodeAt(i);return a}
async function refresh(){status('Loading archived reports…');reportItems=await apiGet('list');let ys=[...new Set(reportItems.map(x=>x.year))].sort((a,b)=>b-a),sel=el('archiveYear').value;el('archiveYear').innerHTML='<option value="">All years</option>'+ys.map(y=>`<option value="${y}">${y}</option>`).join('');el('archiveYear').value=ys.includes(Number(sel))?sel:'';renderEntries();}
function showDiagnostics(){
 const target=el('archiveEntries');
 if(!target)return;
 target.textContent='';
 const link=document.createElement('a');link.href=configured()+'?action=ping&callback=siDiagnostic';
 link.target='_blank';link.rel='noopener noreferrer';link.textContent='Open Apps Script JSONP diagnostic in a new tab';
 const p=document.createElement('p');p.className='hint';p.textContent='The response should look like siDiagnostic({"ok":true,...}); not plain JSON or an HTML page. If this works but the website fails, inspect the browser Console for blocked scripts.';
 target.append(link,p);
}
function renderEntries(){let year=el('archiveYear').value,month=el('archiveMonth').value;let rows=reportItems.filter(x=>(!year||Number(year)===x.year)&&(!month||Number(month)===x.month));status(`${rows.length} report version${rows.length===1?'':'s'} available · ${reportItems.length} total`);el('archiveEntries').innerHTML='';if(!rows.length){el('archiveEntries').textContent='No reports for that reporting period.';return;}rows.forEach(r=>{let div=document.createElement('div');div.className='archive-entry';let period=document.createElement('span');period.className='period';period.textContent=months[r.month-1]+' '+r.year;let info=document.createElement('div'),name=document.createElement('strong'),metadata=document.createElement('small');name.textContent=r.name;metadata.textContent=new Date(r.uploaded).toLocaleString()+' · '+(r.bytes/1048576).toFixed(1)+' MB';info.append(name,metadata);let btn=document.createElement('button');btn.className='quiet';btn.textContent='Open →';btn.onclick=()=>openSaved(r);div.append(period,info,btn);el('archiveEntries').appendChild(div)})}
async function gzipReport(report){
  if(!('CompressionStream' in window))throw Error('Browser does not support compressed reports');
  const minimized={schema:1,name:report.name,stores:report.stores};
  const source=new Blob([JSON.stringify(minimized)],{type:'application/json'});
  const stream=source.stream().pipeThrough(new CompressionStream('gzip'));
  return new Blob([await new Response(stream).arrayBuffer()],{type:'application/gzip'});
}
async function parseCompressed(buffer,r){
  if(!('DecompressionStream' in window))throw Error('Browser does not support compressed reports');
  const stream=new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'));
  const raw=await new Response(stream).text();
  const data=JSON.parse(raw);
  if(data.schema!==1||!data.stores||!Object.keys(data.stores).length)throw Error('Invalid processed report');
  return {name:r.name,loaded:new Date().toLocaleString(),stores:data.stores};
}
async function downloadFile(fileId,bytes,message){
  const meta=await apiGet('startRead',{fileId});
  if(meta.bytes!==bytes)throw Error('Stored report size changed');
  const result=new Uint8Array(meta.bytes);
  for(let offset=0;offset<meta.bytes;offset+=meta.chunkBytes){
    const part=await apiGet('readChunk',{fileId,offset});
    result.set(decode64(part.base64),offset);
    status(message+' '+Math.min(100,Math.round((offset+meta.chunkBytes)/meta.bytes*100))+'%');
  }
  return result.buffer;
}
async function uploadBlob(blob,details){
  const init=await apiPost({action:'begin',year:details.year,month:details.month,
    filename:details.filename,totalBytes:blob.size,kind:details.kind||'workbook',sourceId:details.sourceId||''});
  const count=Math.ceil(blob.size/init.chunkBytes);
  for(let i=0;i<count;i++){
    const bytes=new Uint8Array(await blob.slice(i*init.chunkBytes,(i+1)*init.chunkBytes).arrayBuffer());
    await apiPost({action:'chunk',session:init.session,index:i,base64:toB64(bytes)});
    uploadStatus(details.progress+' '+Math.round((i+1)/count*100)+'%');
  }
  return apiPost({action:'finish',session:init.session});
}
async function openSaved(r){
  if(busy)return;
  busy=true;
  try{
    status('Opening '+r.name+'…');
    if(r.bytes>30*1024*1024)throw Error('Report exceeds 30 MB limit');
    let parsed=null;
    if(r.index){
      try{
        status('Loading optimized report…');
        const idxBuffer=await downloadFile(r.index.id,r.index.bytes,'Loading optimized data');
        parsed=await parseCompressed(idxBuffer,r);
      }catch(err){console.warn('Optimized report unavailable; using original Excel:',err);}
    }
    if(!parsed){
      let buffer=await cacheGet(r.id,r.bytes);
      if(!buffer){buffer=await downloadFile(r.id,r.bytes,'Downloading Excel');cachePut(r.id,r.bytes,buffer);}
      status('Reading Excel workbook…');
      parsed=await readExcel(new File([buffer],r.name,{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
    }
    startReport(parsed);
    activeFile=null;
    el('saveArchive').disabled=true;
    uploadStatus('Opened saved report: '+months[r.month-1]+' '+r.year);
    status('Report opened.');
  }catch(err){status('Unable to open report: '+err.message)}
  finally{busy=false}
}
async function saveFile(){
  if(busy)return;
  if(!activeFile){uploadStatus('Select a new Excel file first.');return;}
  busy=true;el('saveArchive').disabled=true;
  try{
    const year=Number(el('uploadYear').value),month=Number(el('uploadMonth').value);
    if(!Number.isInteger(year)||year<2020||year>2100||month<1||month>12)throw Error('Invalid reporting period');
    if(activeFile.size>30*1048576)throw Error('Excel file exceeds 30 MB');
    uploadStatus('Checking Drive connection…');await apiGet('ping');
    const report=lastParsedReport && lastParsedReport.name===activeFile.name?lastParsedReport:await readExcel(activeFile);
    uploadStatus('Saving original workbook…');
    const saved=await uploadBlob(activeFile,{year,month,filename:activeFile.name,progress:'Saving original Excel'});
    activeFile.arrayBuffer().then(buffer=>cachePut(saved.id,activeFile.size,buffer)).catch(()=>{});
    // The original workbook is safely stored even if the index fails.
    try{
      uploadStatus('Creating optimized dashboard data…');
      const compressed=await gzipReport(report);
      uploadStatus('Saving optimized dashboard data ('+(compressed.size/1048576).toFixed(2)+' MB)…');
      await uploadBlob(compressed,{year,month,filename:'dashboard.json.gz',kind:'index',sourceId:saved.id,progress:'Saving optimized data'});
      uploadStatus('Saved workbook and optimized data successfully.');
    }catch(indexErr){
      console.warn(indexErr);
      uploadStatus('Excel saved, but optimization failed: '+indexErr.message+'. Older download method will be used.');
    }
    activeFile=null;await refresh();
  }catch(err){uploadStatus('Upload failed: '+err.message)}
  finally{busy=false;el('saveArchive').disabled=!activeFile;}
}
window.archiveOnReportLoaded=report=>{lastParsedReport=report;pageBeforeLibrary='overview';updateReturnButton();if(activeFile)el('saveArchive').disabled=false;};
el('libraryBtn').onclick=showLibrary;el('showLibrary').onclick=showLibrary;
el('libraryUpload').onclick=()=>el('fileInput').click();
el('saveArchive').onclick=saveFile;el('refreshArchive').onclick=()=>refresh().catch(e=>status(e.message));
el('archiveMonth').onchange=renderEntries;el('archiveYear').onchange=renderEntries;
el('fileInput').addEventListener('change',e=>{if(e.target.files?.[0]){activeFile=e.target.files[0];el('saveArchive').disabled=false;uploadStatus('Ready to save: '+activeFile.name+' ('+(activeFile.size/1048576).toFixed(1)+' MB). Return to the Report Library and click Save current workbook to Drive.')}},true);
months.forEach((m,i)=>{for(let id of ['archiveMonth','uploadMonth']){let opt=document.createElement('option');opt.value=String(i+1);opt.textContent=m;el(id).appendChild(opt)}});
let now=new Date();el('uploadYear').value=now.getFullYear();el('uploadMonth').value=String(now.getMonth()+1);el('archiveMonth').insertAdjacentHTML('afterbegin','<option value="">All months</option>');el('archiveMonth').value='';
showLibrary();
})();

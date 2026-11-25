const $ = id => document.getElementById(id);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const state = {csrf:'',owner:null,patients:[],patientPage:0,morePatients:false,selected:null,tab:'consultas',entries:[],nextCursor:null,page:0,hasMore:false,generation:0};
const types = {consultas:{title:'Consultas',description:'Atenciones registradas por tu veterinaria.'},vacuna:{title:'Cartilla de vacunación',description:'Vacunas y próximas aplicaciones indicadas.'},desparasitacion:{title:'Cartilla de desparasitación',description:'Desparasitaciones y próximas aplicaciones indicadas.'}};
const text = (value,fallback='No registrado') => value === null || value === undefined || value === '' ? fallback : String(value);
const date = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) return text(value);
  const [year,month,day] = value.split('-');
  return `${day}/${month}/${year}`;
};
function errorMessage(error){return error?.message || 'No se pudo conectar con el servicio. Inténtalo de nuevo.';}
async function request(path, {method='GET',data,query}={}) {
  const response=await fetch('/api/v1/portal/'+path+(query?'?'+new URLSearchParams(query):''),{
    method,credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(45000),
    headers:method==='GET'?{}:{'Content-Type':'application/json',...(state.csrf?{'X-CSRF-Token':state.csrf}:{})},
    ...(method==='GET'?{}:{body:JSON.stringify(data ?? {})})
  });
  let result;
  try {result=await response.json();} catch {throw new Error('No se recibió una respuesta válida. Inténtalo de nuevo.');}
  if (!response.ok){const error=new Error(result.error?.message || 'No se pudo completar la solicitud.');error.status=response.status;throw error;}
  if(typeof result.csrf==='string')state.csrf=result.csrf;
  return result;
}
function clearSession(message=''){
  state.generation++;state.csrf='';state.owner=null;state.patients=[];state.patientPage=0;state.morePatients=false;state.selected=null;state.entries=[];
  $('app').hidden=true;$('record').hidden=true;$('pets').replaceChildren();$('records').replaceChildren();
  for(const id of ['owner-name','record-title','record-subtitle','patient-details','count','record-notice','pets-notice'])$(id).textContent='';
  $('login').hidden=false;$('loading').hidden=true;$('login-notice').textContent=message;
  $('password').value='';
}
function handleError(error,notice){
  if(error.status===401){clearSession('Tu sesión terminó. Ingresa nuevamente.');return;}
  notice.textContent=errorMessage(error);
}
function displaySession(owner){
  state.owner=owner;$('owner-name').textContent=owner.name;$('login').hidden=true;$('loading').hidden=true;$('app').hidden=false;$('login-notice').textContent='';
}
function displayPatients(){
  const html=state.patients.map(patient=>`<button type="button" class="pet" data-patient="${escapeHtml(patient.id)}" aria-pressed="${patient.id===state.selected?.id}"><span class="pet-avatar" aria-hidden="true">${escapeHtml((patient.name || '?').trim().slice(0,1).toLocaleUpperCase('es-MX'))}</span><span class="pet-text"><strong>${escapeHtml(patient.name)}</strong><small>${escapeHtml(text(patient.species))}${patient.breed?' · '+escapeHtml(patient.breed):''}</small></span></button>`).join('');
  $('pets').innerHTML=html+(state.morePatients?'<button type="button" class="button secondary" id="more-pets">Ver más mascotas</button>':'');
  if(!state.patients.length && !state.morePatients)$('pets-notice').textContent='Todavía no hay mascotas vinculadas a tu cuenta. Contacta a tu veterinaria si necesitas ayuda.';
}
async function loadPatients(){
  const generation=state.generation;$('pets-notice').textContent='Cargando mascotas…';
  const more=$('more-pets');if(more)more.disabled=true;
  try{
    const result=await request('patients',{query:{page:state.patientPage+1}});if(generation!==state.generation)return;
    state.patientPage=result.page;state.morePatients=result.hasMore;state.patients.push(...result.patients);$('pets-notice').textContent='';displayPatients();
    if(!state.selected&&state.patients.length)await selectPatient(state.patients[0]);
  }catch(error){if(generation===state.generation){handleError(error,$('pets-notice'));if(state.owner){if(more)more.disabled=false;else if(!state.patients.length)$('pets').innerHTML='<button type="button" class="button secondary" id="more-pets">Reintentar</button>';}}}
}
function patientDetails(patient){
  const pieces=[patient.species,patient.breed,patient.birthDate?'Nacimiento: '+date(patient.birthDate):null,patient.ageValue!==null&&patient.ageValue!==undefined?'Edad registrada: '+patient.ageValue+' '+({dias:'días',meses:'meses',anios:'años'}[patient.ageUnit]||''):null];
  $('patient-details').innerHTML=pieces.filter(Boolean).map(piece=>`<span>${escapeHtml(piece)}</span>`).join('');
}
async function selectPatient(patient){
  state.generation++;state.selected=patient;state.tab='consultas';state.entries=[];state.nextCursor=null;state.page=0;state.hasMore=false;
  displayPatients();$('record').hidden=false;$('record-title').textContent='Expediente de '+patient.name;$('record-subtitle').textContent='Su información clínica, reunida en un solo lugar.';patientDetails(patient);await selectTab('consultas');
}
function renderEntry(entry){
  const consultation=state.tab==='consultas';
  const title=consultation?'Consulta':text(entry.product,'Producto no registrado');
  const fields=consultation?[["Motivo o diagnóstico",entry.reason],["Tratamiento",entry.treatment],["Observaciones",entry.notes]]:state.tab==='vacuna'?[["Aplicación",entry.application],["Próxima aplicación",entry.nextDate?date(entry.nextDate):null]]:[["Próxima aplicación",entry.nextDate?date(entry.nextDate):null]];
  const metrics=consultation?[[entry.weight,'Peso',1000,'kg'],[entry.temperature,'Temperatura',100,'°C'],[entry.heartRate,'Frecuencia cardiaca',1,'latidos/min'],[entry.respiratoryRate,'Frecuencia respiratoria',1,'respiraciones/min']]:[[entry.weight,'Peso',1000,'kg']];
  const fieldHtml=fields.filter(([,value])=>value!==null&&value!==undefined&&value!=='').map(([label,value])=>`<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('');
  const metricHtml=metrics.filter(([value])=>value!==null&&value!==undefined).map(([value,label,scale,unit])=>`<span>${escapeHtml(label)}: ${escapeHtml(Number(value)/scale)} ${escapeHtml(unit)}</span>`).join('');
  return `<article class="entry"><span class="entry-icon" aria-hidden="true"><svg><use href="#card"/></svg></span><div><div class="entry-head"><h4>${escapeHtml(title)}</h4><time>${escapeHtml(date(entry.date))}</time></div>${fieldHtml?'<dl>'+fieldHtml+'</dl>':''}${metricHtml?'<div class="metrics">'+metricHtml+'</div>':''}</div></article>`;
}
function renderEntries(){
  $('records').innerHTML=state.entries.length?state.entries.map(renderEntry).join(''):'<div class="empty"><strong>Aún no hay registros</strong>Cuando tu veterinaria agregue información, podrás consultarla aquí.</div>';
  $('count').textContent=state.entries.length?`${state.entries.length} mostrado${state.entries.length===1?'':'s'}`:'';
  $('load-more').hidden=!state.hasMore;$('load-more').disabled=false;$('load-more').textContent='Ver más registros';
}
async function selectTab(tab){
  if(!Object.hasOwn(types,tab))return;
  state.generation++;state.tab=tab;state.entries=[];state.nextCursor=null;state.page=0;state.hasMore=false;
  document.querySelectorAll('[data-tab]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.tab===tab)));
  $('list-title').textContent=types[tab].title;$('list-description').textContent=types[tab].description;$('count').textContent='';$('records').replaceChildren();$('load-more').hidden=true;await loadEntries();
}
async function loadEntries(){
  const generation=state.generation,patientId=state.selected.id,tab=state.tab;
  $('record-notice').textContent='Cargando registros…';$('load-more').disabled=true;
  try{
    const result=tab==='consultas'?await request('history',{query:{patientId,...(state.nextCursor?{cursor:state.nextCursor}:{})}}):await request('sanitary-events',{query:{patientId,kind:tab,page:state.page+1}});
    if(generation!==state.generation)return;
    if(tab==='consultas'){state.entries.push(...result.consultations);state.nextCursor=result.nextCursor;state.hasMore=!!result.nextCursor;if(result.patient)patientDetails(result.patient);}
    else{state.entries.push(...result.events);state.page=result.page;state.hasMore=!!result.hasMore;}
    $('record-notice').textContent='';renderEntries();
  }catch(error){if(generation===state.generation){handleError(error,$('record-notice'));if(state.owner){$('load-more').hidden=false;$('load-more').disabled=false;$('load-more').textContent='Reintentar';}}}
}
$('login-form').addEventListener('submit',async event=>{
  event.preventDefault();$('login-button').disabled=true;$('login-notice').textContent='Iniciando sesión…';
  try{const result=await request('login',{method:'POST',data:{username:$('username').value.trim(),password:$('password').value}});$('password').value='';displaySession(result.owner);await loadPatients();}
  catch(error){$('login-notice').textContent=errorMessage(error);$('password').value='';}
  finally{$('login-button').disabled=false;}
});
$('logout').addEventListener('click',async()=>{
  $('logout').disabled=true;
  try{await request('logout',{method:'POST'});clearSession();}catch(error){if(error.status===401)clearSession();else $('pets-notice').textContent=errorMessage(error);}finally{$('logout').disabled=false;}
});
$('pets').addEventListener('click',event=>{const button=event.target.closest('[data-patient]');if(button){const patient=state.patients.find(item=>item.id===button.dataset.patient);if(patient)selectPatient(patient);}else if(event.target.closest('#more-pets'))loadPatients();});
document.querySelector('.tabs').addEventListener('click',event=>{const button=event.target.closest('[data-tab]');if(button&&button.dataset.tab!==state.tab)selectTab(button.dataset.tab);});
$('load-more').addEventListener('click',loadEntries);
try{const result=await request('session');displaySession(result.owner);await loadPatients();}catch(error){clearSession(error.status===401?'':errorMessage(error));}

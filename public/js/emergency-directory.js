/* Public directory only. No passports, account data, inferred emergency numbers or geolocation. */
globalThis.PackSwiftEmergencyDirectory=(()=>{
  const codes='AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW XK'.split(' ');
  const names=new Intl.DisplayNames(['en'],{type:'region'});
  const countries=codes.map(code=>({code,name:code==='XK'?'Kosovo':names.of(code)})).sort((a,b)=>a.name.localeCompare(b.name));
  const normalize=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const aliases={usa:'US',unitedstatesofamerica:'US',america:'US',uk:'GB',greatbritain:'GB',england:'GB',scotland:'GB',wales:'GB',northernireland:'GB',uae:'AE',southkorea:'KR',northkorea:'KP',russia:'RU',vietnam:'VN',turkey:'TR',czechrepublic:'CZ',myanmar:'MM',burma:'MM',ivorycoast:'CI',swaziland:'SZ',easttimor:'TL'};
  const sourceHosts=new Set(['digital-strategy.ec.europa.eu','www.911.gov','www.infrastructure.gov.au','www.police.govt.nz','www.gov.uk','www.mha.gov.in','www.gov.sg','www.tourismthailand.org','www.japan.travel']);
  function countryCode(value){const key=normalize(value);return aliases[key]||countries.find(c=>normalize(c.code)===key||normalize(c.name)===key)?.code||'';}
  function validate(data){
    if(data?.version!==1||!Array.isArray(data.groups)||!Number.isInteger(data.reviewAfterDays)||data.reviewAfterDays<1||data.reviewAfterDays>365)throw Error('Directory format unavailable.');
    const seen=new Set();
    for(const g of data.groups){
      if(!Array.isArray(g.countries)||!g.countries.length||!/^\d{4}-\d{2}-\d{2}$/.test(g.verifiedAt||'')||!Number.isFinite(Date.parse(g.verifiedAt))||new Date(g.verifiedAt).toISOString().slice(0,10)!==g.verifiedAt||!Array.isArray(g.contacts)||!g.contacts.length)throw Error('Directory record unavailable.');
      const u=new URL(g.source);if(u.protocol!=='https:'||u.username||u.password||u.port||!sourceHosts.has(u.hostname))throw Error('Invalid official source.');
      for(const c of g.countries){if(!codes.includes(c)||seen.has(c))throw Error('Duplicate or unknown area.');seen.add(c);}
      for(const c of g.contacts)if(typeof c.service!=='string'||!c.service||c.service.length>140||typeof c.number!=='string'||!/^\+?[0-9][0-9 -]{1,30}$/.test(c.number)||typeof c.dialing!=='string')throw Error('Invalid contact record.');
    }
    return data;
  }
  function lookup(data,value,now=new Date()){
    const code=countryCode(value),group=data.groups.find(g=>g.countries.includes(code)),country=countries.find(c=>c.code===code);
    if(!group)return {code,name:country?.name||'',status:code?'missing':'unknown',contacts:[]};
    const age=(now.getTime()-Date.parse(group.verifiedAt))/86400000;
    const status=age< -1?'unverified':age>data.reviewAfterDays?'review-due':'reviewed';
    return {...group,code,name:country.name,status,contacts:status==='unverified'?[]:group.contacts.map(c=>({...c,source:group.source,verifiedAt:group.verifiedAt}))};
  }
  let pending;
  function load(refresh=false){if(refresh)pending=null;return pending||=(fetch('/data/emergency-contacts.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('Directory unavailable.');return r.json();}).then(validate).catch(e=>{pending=null;throw e;}));}
  const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
  function mount(container,{country='',onResult=()=>{}}={}){
    const wrapper=el('div'),label=el('label','Emergency contacts for'),select=el('select'),body=el('div');body.setAttribute('aria-live','polite');
    select.append(new Option('Choose country or area',''));for(const c of countries)select.append(new Option(c.name,c.code));
    select.value=countryCode(country);label.append(select);wrapper.append(label,body);container.append(wrapper);
    let sequence=0;
    const draw=async()=>{
      const version=++sequence;body.replaceChildren(el('p','Loading contact directory…'));onResult(null);
      try{
        const data=await load();if(version!==sequence||!container.isConnected)return;
        const result=lookup(data,select.value);body.replaceChildren();
        body.append(el('p',result.status==='reviewed'?'Official-source contacts · reviewed '+result.verifiedAt:result.status==='review-due'?'Review overdue · last reviewed '+result.verifiedAt+'. Confirm with the official source.':result.status==='unknown'?'Select the country you will be in.':'Verified contacts unavailable for this area. Do not use neighboring countries’ numbers.'));
        if(result.scope)body.append(el('p',result.scope));
        for(const c of result.contacts){
          const row=el('div');row.className='dashboard-row';const info=el('div');info.append(el('strong',c.service),el('small',c.dialing));const a=el('a',c.number);a.className='dashboard-link';a.href='tel:'+c.number.replace(/[ -]/g,'');a.setAttribute('aria-label','Call '+c.service+' '+c.number);row.append(info,a);body.append(row);
        }
        if(result.source){const a=el('a','View official source ↗');a.href=result.source;a.target='_blank';a.rel='noopener noreferrer';body.append(a);}
        if(!result.contacts.length){const a=el('a','Check the ITU country directory ↗');a.href='https://www.itu.int/net/itu-t/inrdb/e129_important_numbers.aspx';a.target='_blank';a.rel='noopener noreferrer';body.append(a);}
        body.append(el('p','Short codes are for local use. Live availability is not confirmed. Never make test calls.'));
        onResult(result);
      }catch{if(version===sequence&&container.isConnected){body.replaceChildren(el('p','Directory unavailable. No numbers are shown.'));const retry=el('button','Try loading again');retry.type='button';retry.onclick=draw;body.append(retry);}}
    };
    select.onchange=draw;draw();return {select,refresh:draw};
  }
  return {countries,countryCode,validate,lookup,load,mount};
})();

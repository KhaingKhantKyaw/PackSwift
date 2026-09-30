(() => {
  'use strict';
  // Country facts are separate from city content so new catalog entries inherit them.
  const facts = {
    Thailand:['Thai','THB ฿'], Myanmar:['Burmese','MMK Ks'], Vietnam:['Vietnamese','VND ₫'],
    Singapore:['English, Malay, Mandarin & Tamil','SGD S$'], Indonesia:['Indonesian','IDR Rp'],
    Malaysia:['Malay','MYR RM'], Japan:['Japanese','JPY ¥'], 'South Korea':['Korean','KRW ₩'],
    China:['Mandarin Chinese','CNY ¥'], India:['Hindi, English & regional languages','INR ₹'],
    Philippines:['Filipino & English','PHP ₱'], France:['French','EUR €'], Italy:['Italian','EUR €'],
    Spain:['Spanish & regional languages','EUR €'], Germany:['German','EUR €'],
    Switzerland:['German, French, Italian & Romansh','CHF'], Netherlands:['Dutch','EUR €'],
    Greece:['Greek','EUR €'], Portugal:['Portuguese','EUR €'], USA:['English widely used','USD $'],
    Canada:['English & French','CAD C$'], Mexico:['Spanish','MXN'], Brazil:['Portuguese','BRL R$'],
    Australia:['English','AUD A$'], 'New Zealand':['English & Māori','NZD NZ$'],
    UAE:['Arabic','AED'], Qatar:['Arabic','QAR'], 'Saudi Arabia':['Arabic','SAR'],
    'South Africa':['Multiple official languages; English widely used','ZAR R'],
    Morocco:['Arabic & Amazigh','MAD'], Egypt:['Arabic','EGP'], Kenya:['Swahili & English','KES']
  };
  const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;};
  function build(city={}) {
    const name=city.name||'Your destination', country=city.country||'';
    const local=facts[country]||['Check local language guidance','Confirm local currency'];
    const bangkok=name.toLowerCase()==='bangkok';
    return {name,country,overview:bangkok?'Thailand’s energetic capital, known for temples, street food, shopping, nightlife, and the Chao Phraya River.':city.description||`${name}${country?`, ${country}`:''}${city.interests?.length?` — discover its ${city.interests.slice(0,3).join(', ')} experiences}`:'. Explore neighbourhoods and local highlights at your own pace.'}`,
      facts:[['Language',local[0]],['Currency',local[1]],['Transport',bangkok?'BTS · MRT · Taxi · Ride-hailing · River boats':'Compare local transit, walking routes and licensed transfers.'],['Airports',bangkok?'BKK · Suvarnabhumi / DMK · Don Mueang':'Confirm the airport and transfer distance on your booking.']],
      advice:[['☀','Weather',bangkok?'Hot and humid. Carry water, sunscreen and a small umbrella.':'Check the forecast for your travel dates; pack layers and rain or sun protection as needed.'],['🚆','Getting around',bangkok?'Use BTS/MRT to avoid traffic. Check routes and agree fares before taxi or tuk-tuk rides.':'Group nearby activities and check current transit routes, service hours and fares.'],['💳','Money','Keep a small cash reserve for markets and small shops. Check card acceptance and ATM fees.'],['🏛','Local etiquette',bangkok?'Dress modestly at temples, remove shoes when required and respect religious areas.':(city.culturalNotes||[]).join(' ')||'Check local dress, photography and religious-site customs before visiting.'],['🛡','Safety',bangkok?'Confirm prices before tuk-tuk rides. Be cautious if someone says a major attraction is unexpectedly closed.':'Check current official travel advice for your exact route. Inclusion in this guide is not a safety endorsement.'],['☎','Emergency',bangkok?'Tourist Police: 1155':'Verify local emergency numbers with official authorities and save them offline.']],
      attractions:city.attractions||[],tip:bangkok?'Plan outdoor attractions in the morning or late afternoon and use indoor activities during the hottest hours.':'Build each day around one area, check opening days, and leave room for rest and local discoveries.',
      source:bangkok?'https://www.touristpolice.go.th/':null};
  }
  function render(city, {compact=false}={}) {
    const data=build(city),root=el('section',null,'city-briefing');
    root.append(el('span','YOUR DESTINATION, AT A GLANCE','city-briefing-kicker'),el('h3',`${data.name}${data.country?`, ${data.country}`:''}`),el('p',data.overview,'city-briefing-overview'));
    const factsGrid=el('dl',null,'city-briefing-facts');data.facts.forEach(([label,value])=>{const item=el('div');item.append(el('dt',label),el('dd',value));factsGrid.append(item);});root.append(factsGrid);
    const details=el('details',null,'city-briefing-details');details.open=!compact;details.append(el('summary','Before you go'));
    const grid=el('div',null,'city-briefing-grid');data.advice.forEach(([icon,title,text])=>{const c=el('article');const h=el('h4');const symbol=el('span',icon,'city-briefing-icon');symbol.setAttribute('aria-hidden','true');h.append(symbol,document.createTextNode(title));c.append(h,el('p',text));grid.append(c);});details.append(grid);root.append(details);
    if(data.attractions.length){root.append(el('h4','Don’t miss'));const list=el('div',null,'city-briefing-highlights');data.attractions.forEach(place=>{const a=el('a',place+' ↗');a.href='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(place+', '+data.name);a.target='_blank';a.rel='noopener noreferrer';list.append(a);});root.append(list);}else root.append(el('p','Local highlights will appear when destination information is available.','city-briefing-note'));
    const tip=el('aside',null,'city-briefing-tip');tip.append(el('strong','✦ PackSwift tip'),el('p',data.tip));root.append(tip);
    root.append(el('small','Planning inspiration, not live conditions. Verify travel advice, entry rules and venue details before departure.','city-briefing-note'));
    if(data.source){const a=el('a','Tourist Police · official information ↗','city-briefing-source');a.href=data.source;a.target='_blank';a.rel='noopener noreferrer';root.append(a);}return root;
  }
  window.PackSwiftCityBriefing={build,render};
})();

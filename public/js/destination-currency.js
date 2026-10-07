/* Shared geographic lookup: catalog city -> country -> currency. No network rates implied. */
globalThis.PackSwiftCurrency = (() => {
 const cityCountries={"tokyo":"Japan","seoul":"South Korea","singapore":"Singapore","kuala lumpur":"Malaysia","bali":"Indonesia","hanoi":"Vietnam","palawan":"Philippines","beijing":"China","jaipur":"India","bangkok":"Thailand","chiang mai":"Thailand","phuket":"Thailand","yangon":"Myanmar","bagan":"Myanmar","mandalay":"Myanmar","paris":"France","rome":"Italy","barcelona":"Spain","berlin":"Germany","zurich":"Switzerland","amsterdam":"Netherlands","athens":"Greece","lisbon":"Portugal","new york city":"USA","vancouver":"Canada","mexico city":"Mexico","rio de janeiro":"Brazil","sydney":"Australia","auckland":"New Zealand","dubai":"UAE","doha":"Qatar","riyadh":"Saudi Arabia","cape town":"South Africa","marrakech":"Morocco","cairo":"Egypt","nairobi":"Kenya","london":"United Kingdom","bkk":"Thailand","dmk":"Thailand","rgn":"Myanmar","ygn":"Myanmar","sin":"Singapore","tyo":"Japan","hkt":"Thailand","cnx":"Thailand"};
 const countryCurrencies={"thailand":"THB","vietnam":"VND","myanmar":"MMK","singapore":"SGD","japan":"JPY","south korea":"KRW","united kingdom":"GBP","france":"EUR","italy":"EUR","spain":"EUR","germany":"EUR","netherlands":"EUR","greece":"EUR","portugal":"EUR","usa":"USD","united states":"USD","china":"CNY","indonesia":"IDR","malaysia":"MYR","philippines":"PHP","india":"INR","switzerland":"CHF","canada":"CAD","mexico":"MXN","brazil":"BRL","australia":"AUD","new zealand":"NZD","uae":"AED","qatar":"QAR","saudi arabia":"SAR","south africa":"ZAR","morocco":"MAD","egypt":"EGP","kenya":"KES"};
 const symbols={USD:'$',THB:'฿',VND:'₫',MMK:'Ks',SGD:'S$',JPY:'¥',KRW:'₩',GBP:'£',EUR:'€',CNY:'¥',IDR:'Rp',MYR:'RM',PHP:'₱',INR:'₹'};
 const countryCodes={thailand:'TH',vietnam:'VN',myanmar:'MM',singapore:'SG',japan:'JP','south korea':'KR','united kingdom':'GB',france:'FR',italy:'IT',spain:'ES',germany:'DE',netherlands:'NL',greece:'GR',portugal:'PT',usa:'US','united states':'US',china:'CN',indonesia:'ID',malaysia:'MY',philippines:'PH',india:'IN',switzerland:'CH',canada:'CA',mexico:'MX',brazil:'BR',australia:'AU','new zealand':'NZ',uae:'AE',qatar:'QA','saudi arabia':'SA','south africa':'ZA',morocco:'MA',egypt:'EG',kenya:'KE'};
 const currencies=Object.fromEntries([...new Set(Object.values(countryCurrencies))].map(code=>[code,{symbol:symbols[code]||code,suggested:null}]));
 function resolve(destination){
  const parts=(typeof destination==='object'?[destination?.country,destination?.name]:String(destination||'').split(',').reverse()).filter(Boolean).map(v=>v.trim().toLowerCase());
  let country=parts.find(p=>countryCurrencies[p])||parts.map(p=>cityCountries[p]).find(Boolean)?.toLowerCase();
  const code=countryCurrencies[country]||'USD';
  return {code,...currencies[code],country:country||'',countryCode:countryCodes[country]||'',known:Boolean(country)};
 }
 function formatCurrency(amount,destination){return new Intl.NumberFormat('en',{style:'currency',currency:resolve(destination).code,currencyDisplay:'code'}).format(Number(amount)||0);}
 return {resolve,formatCurrency,currencies,cityCountries,countryCurrencies};
})();

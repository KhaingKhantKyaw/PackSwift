import {bookingExchangeRate} from './booking-exchange-rate.js';
export async function dashboardCurrencyRate(base,target,{provider=bookingExchangeRate}={}) {
  if(!/^[A-Z]{3}$/.test(base||'')||!/^[A-Z]{3}$/.test(target||''))throw new RangeError('Choose valid currencies.');
  if(base===target)return {base,target,rate:1,updated:null,source:'Same currency'};
  const [from,to]=await Promise.all([base==='USD'?null:provider(base),target==='USD'?null:provider(target)]);
  const rate=(to?.rate??1)/(from?.rate??1);
  if(!Number.isFinite(rate)||rate<=0)throw Error('Invalid exchange rate.');
  const dates=[from?.updatedAt,to?.updatedAt].filter(Boolean).sort();
  return {base,target,rate,updated:dates[0],source:'ExchangeRate-API',sourceUrl:'https://www.exchangerate-api.com'};
}

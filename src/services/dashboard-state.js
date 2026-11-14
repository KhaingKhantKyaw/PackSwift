const uuid = /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;
const text = (value, max, name) => {
  if (typeof value !== 'string' || value.length > max) throw new RangeError('Invalid ' + name + '.');
  return value.trim();
};
export function validateDashboardState(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data) || !Number.isSafeInteger(data.revision) || data.revision < 0 || data.revision >= Number.MAX_SAFE_INTEGER) throw new RangeError('Reload the dashboard before saving.');
  const result = {revision:data.revision};
  if(data.experience!==undefined&&!['','first','experienced'].includes(data.experience))throw new RangeError('Choose a valid travel experience level.');
  result.experience=data.experience||'';
  result.currency = text(data.currency, 3, 'currency');
  if (!/^[A-Z]{3}$/.test(result.currency)) throw new RangeError('Choose a valid currency.');
  for (const key of ['expenses','stories','contacts','entryChecks']) {
    if (!Array.isArray(data[key]) || data[key].length > 200) throw new RangeError('Use up to 200 ' + key + '.');
    const ids = new Set();
    result[key] = data[key].map(row => {
      if (!row || typeof row !== 'object' || !uuid.test(row.id) || !uuid.test(row.tripId) || ids.has(row.id)) throw new RangeError('Invalid dashboard item.');
      ids.add(row.id);
      const item = {id:row.id,tripId:row.tripId};
      if (key === 'expenses') {
        if (typeof row.amount !== 'number' || !Number.isFinite(row.amount) || row.amount < 0.01 || row.amount > 1e9) throw new RangeError('Enter an expense amount of at least 0.01.');
        item.amount = Math.round(row.amount * 100) / 100;
        item.currency = text(row.currency,3,'expense currency');
        if (!/^[A-Z]{3}$/.test(item.currency)) throw new RangeError('Invalid expense currency.');
        if (!['Flights','Stay','Food','Transport','Activities','Other'].includes(row.category)) throw new RangeError('Invalid expense category.');
        item.category = row.category;
        item.note = text(row.note,160,'expense note');
        item.date = text(row.date,10,'expense date');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(item.date) || !Number.isFinite(Date.parse(item.date)) || new Date(item.date).toISOString().slice(0,10) !== item.date) throw new RangeError('Invalid expense date.');
        if (!['Personal','Shared total'].includes(row.scope)) throw new RangeError('Invalid expense scope.');
        item.scope = row.scope;
        const people=row.peopleCount??1;
        if(!Number.isInteger(people)||people<1||people>30)throw new RangeError('Split expenses between 1–30 people.');
        item.peopleCount=row.scope==='Shared total'?people:1;
      } else if (key === 'stories') {
        item.title = text(row.title,100,'experience title');
        item.body = text(row.body,3000,'experience');
        if (!item.title || !item.body) throw new RangeError('Add a title and your experience.');
      } else if (key === 'contacts') {
        item.name = text(row.name,100,'contact name');
        item.phone = text(row.phone,32,'phone');
        if (!item.name || !/^[+\d][\d ()-]{1,31}$/.test(item.phone)) throw new RangeError('Enter a valid contact number.');
        item.source = text(row.source,500,'source');
        if (item.source) { let u; try {u=new URL(item.source);} catch {throw new RangeError('Use an HTTPS source link.');} if(u.protocol!=='https:'||u.username||u.password)throw new RangeError('Use an HTTPS source link.'); }
      } else {
        for (const [name,max] of [['passportCountry',100],['passportType',60],['residence',100],['purpose',100],['transit',200],['notes',1500],['source',500]]) item[name]=text(row[name],max,name);
        item.journey=typeof row.journey==='string'?text(row.journey,600,'journey'):'';
        if (item.source) { let u; try{u=new URL(item.source);}catch{throw new RangeError('Use an HTTPS official source.');}if(u.protocol!=='https:'||u.username||u.password)throw new RangeError('Use an HTTPS official source.'); }
        if (typeof row.reviewed !== 'boolean') throw new RangeError('Invalid entry review.');
        if(row.reviewed&&(!item.passportCountry||!item.purpose||!item.source))throw new RangeError('Add passport country, purpose and an official source before marking reviewed.');
        item.reviewed=row.reviewed;
      }
      return item;
    });
  }
  if(JSON.stringify(result).length>90000)throw new RangeError('Your dashboard is full. Remove older items before adding more.');
  return result;
}

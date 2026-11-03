// Separate relevant searches keep every chosen purpose represented in the feed.
export const activityTopics=Object.freeze({
 'Relaxation & Wellness':['spas and wellness experiences','peaceful gardens and relaxation spots','massage and wellness centers'],
 'Nature & Outdoor':['nature parks and outdoor activities','scenic walks and botanical gardens','outdoor recreation and nature experiences'],
 'Food, Drink & Culinary':['local food markets and street food','cooking classes and culinary experiences','local restaurants and cafes'],
 'Shopping & Fashion':['shopping markets and boutiques','local craft shops and fashion stores','shopping centers and vintage shops'],
 'Nightlife & Entertainment':['live music and evening entertainment','comedy clubs and performance venues','night markets and nightlife'],
 'Local Life & Socializing':['local neighborhood markets and cafes','community workshops and cultural experiences','local walking tours and social activities'],
 'Events, Festivals & Sports':['sports activities and event venues','performing arts and cultural venues','recreation centers and sports clubs'],
 'Content Creation & Photography':['scenic viewpoints and photography spots','photogenic streets and landmarks','gardens and architecture photography'],
 'Water & Marine Activities':['boat tours and water activities','kayaking and water sports','river cruises and waterfront experiences'],
 'Culture, History & Heritage':['museums and historic sites','temples and cultural landmarks','heritage tours and cultural centers']
});
export const activityStyles=Object.freeze({
 'Pocket Friendly':'free and affordable',
 'Balanced':'good value popular',
 'Comfort & Value':'comfortable highly rated',
 'Full Experience':'immersive local',
 'Ultimate Luxury':'premium private luxury'
});
export function activitySearchQuery(destination,purpose,style,variant=0){
 if(!Object.hasOwn(activityTopics,purpose)||!Object.hasOwn(activityStyles,style)||!Number.isInteger(variant)||variant<0||variant>2)throw Object.assign(new Error('Choose valid travel purposes and a travel style.'),{status:422});
 return `${activityStyles[style]} ${activityTopics[purpose][variant]} in ${destination}`;
}
export function rankActivities(items,style){
 const prices={PRICE_LEVEL_FREE:0,PRICE_LEVEL_INEXPENSIVE:1,PRICE_LEVEL_MODERATE:2,PRICE_LEVEL_EXPENSIVE:3,PRICE_LEVEL_VERY_EXPENSIVE:4};
 const fit=item=>{const price=prices[item.priceLevel];if(price===undefined)return 2;
  if(style==='Pocket Friendly')return price<=1?0:price;
  if(style==='Balanced'||style==='Comfort & Value')return price<=2?0:price;
  if(style==='Ultimate Luxury')return price>=3?0:2;
  return 0;
 };
 return [...items].sort((a,b)=>fit(a)-fit(b)||(style==='Comfort & Value'||style==='Ultimate Luxury'?(b.rating??0)-(a.rating??0):0)||(b.ratingCount??-1)-(a.ratingCount??-1)||(b.rating??0)-(a.rating??0));
}

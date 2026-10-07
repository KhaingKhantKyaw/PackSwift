const search=document.querySelector('#help-search');
const questions=[...document.querySelectorAll('#help-questions details')];
function filterHelp(){
 const query=search.value.trim().toLocaleLowerCase();let matches=0;
 for(const question of questions){const match=(question.textContent+' '+question.dataset.topics).toLocaleLowerCase().includes(query);question.hidden=!match;if(match)matches++;}
 document.querySelector('#help-search-status').textContent=query?(matches?`${matches} help topics found.`:'No matching topics. Try another word or ask PackSwift.'):'';
 for(const button of document.querySelectorAll('[data-help-topic]'))button.setAttribute('aria-pressed',String(button.dataset.helpTopic===query));
}
search.addEventListener('input',filterHelp);
document.querySelectorAll('[data-help-topic]').forEach(button=>button.addEventListener('click',()=>{search.value=button.dataset.helpTopic;filterHelp();search.focus();}));
filterHelp();

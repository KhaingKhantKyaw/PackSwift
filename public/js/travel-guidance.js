/* Changes guidance density only; itinerary, budget, pace and packing stay untouched. */
(() => {
  'use strict';
  const model = window.PackSwiftTravelGuidanceModel;
  if (!model) return;
  const create = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  let field, panel, observer;
  const choices = new Map(), levels = new Map();
  let modeNote, reset;

  function ensureField() {
    const form = document.getElementById('trip-planner-form');
    field = document.getElementById('travel-guidance-state') || field;
    if (!field) {
      field = create('input');
      field.type = 'hidden';
      field.name = 'travelGuidance';
      field.id = 'travel-guidance-state';
      field.setAttribute('form', 'trip-planner-form');
      field.value = JSON.stringify(model.normalize());
    }
    const parent = form || document.body;
    if (parent && !field.isConnected) parent.append(field);
    return field;
  }
  function read() { return model.normalize(ensureField().value); }
  function getMode() { return model.mode(read()); }
  function getInput() {
    const form = document.getElementById('trip-planner-form');
    const values = form ? Object.fromEntries(new FormData(form)) : {};
    return { ...values, travelGuidance: read() };
  }
  function getTasks() { return model.tasks(getInput()); }
  function emit() {
    window.dispatchEvent(new CustomEvent('packswift:guidance-changed', { detail: { state: read(), mode: getMode() } }));
  }
  function update(patch) {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return read();
    const next = model.normalize({ ...read(), ...patch, version: 1 });
    ensureField().value = JSON.stringify(next);
    draw();
    field.dispatchEvent(new Event('input', { bubbles: true }));
    emit();
    return next;
  }
  function setLevel(level) {
    return ['auto', 'detailed', 'quick'].includes(level) ? update({ detailLevel: level }) : read();
  }
  function draw() {
    if (!panel) return;
    const state = read(), mode = model.mode(state);
    choices.forEach((choice, value) => {
      choice.setAttribute('aria-checked', String(state.experience === value));
      choice.tabIndex = value === (state.experience || 'first') ? 0 : -1;
    });
    levels.forEach((control, value) => control.setAttribute('aria-pressed', String(mode === value)));
    reset.hidden = state.detailLevel === 'auto';
    modeNote.textContent = state.detailLevel !== 'auto' ? 'Your chosen view is kept until you change it.' : state.experience === 'first' ? 'More guidance is on. Your trip choices stay unchanged.' : state.experience === 'experienced' ? 'Quick view is on. More guidance is always available.' : 'Optional — switch the amount of help at any time.';
    panel.dataset.guidanceMode = mode;
  }
  function makePanel() {
    panel = create('section', undefined, 'travel-guidance-panel sketch-field');
    panel.dataset.field = 'Travel experience';
    panel.setAttribute('aria-labelledby', 'travel-guidance-heading');
    const heading = create('h2', 'Travel experience');
    heading.id = 'travel-guidance-heading';
    const icon=window.PackSwiftWorkspace?.icon('people');if(icon){icon.setAttribute('aria-hidden','true');heading.prepend(icon);}
    panel.append(heading, create('p', 'Have you travelled before?', 'travel-guidance-intro'));
    const options = create('div', undefined, 'travel-guidance-choices');
    options.setAttribute('role', 'radiogroup');
    options.setAttribute('aria-label', 'Travel experience (optional)');
    const definitions = [
      ['first', 'This is my first trip', 'Clear steps and helpful explanations.'],
      ['experienced', "I've travelled before", 'Essential checks and quick reminders.']
    ];
    definitions.forEach(([value, title, copy], index) => {
      const control = create('button', undefined, 'travel-guidance-choice');
      control.type = 'button';
      control.setAttribute('role', 'radio');
      control.setAttribute('aria-checked', 'false');
      control.append(create('span', title, 'travel-guidance-choice-title'), create('span', copy, 'travel-guidance-choice-copy'));
      control.addEventListener('click', () => update({ experience: value }));
      control.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? definitions.length - 1 : (index + (['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1) + definitions.length) % definitions.length;
        const next = definitions[nextIndex][0];
        update({ experience: next });
        choices.get(next).focus({ preventScroll: true });
      });
      choices.set(value, control);
      options.append(control);
    });
    panel.append(options);
    const view = create('div', undefined, 'travel-guidance-view');
    view.append(create('span', 'Guidance view', 'travel-guidance-view-label'));
    const controls = create('div', undefined, 'travel-guidance-levels');
    controls.setAttribute('role', 'group');
    controls.setAttribute('aria-label', 'Guidance detail level');
    for (const [value, title] of [['detailed', 'More guidance'], ['quick', 'Quick view']]) {
      const control = create('button', title);
      control.type = 'button';
      control.addEventListener('click', () => setLevel(value));
      levels.set(value, control);
      controls.append(control);
    }
    view.append(controls);
    panel.append(view);
    modeNote = create('p', '', 'travel-guidance-note');
    modeNote.setAttribute('role', 'status');
    reset = create('button', 'Use experience default', 'travel-guidance-reset');
    reset.type = 'button';
    reset.addEventListener('click', () => setLevel('auto'));
    const footer=create('div',undefined,'travel-guidance-footer');footer.append(modeNote,reset);panel.append(footer);
  }
  function mount() {
    ensureField();
    const comfort = document.querySelector('.trip-comfort-controls');
    if (!comfort) return false;
    if (!panel) makePanel();
    if (panel.nextElementSibling !== comfort) comfort.before(panel);
    observer?.disconnect();
    observer = null;
    draw();
    return true;
  }
  function ready() {
    if (mount() || observer || !document.body) return;
    // planner-sketch constructs Trip Comfort after the early draft-state scripts.
    observer = new MutationObserver(() => mount());
    observer.observe(document.getElementById('trip-planner-form') || document.body, { childList: true, subtree: true });
  }
  function restored() { ready(); draw(); emit(); }
  window.PackSwiftTravelGuidance = { read, getMode, setLevel, update, getInput, getTasks };
  ensureField();
  ready();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready, { once: true });
  window.addEventListener('packswift:draft-restored', restored);
  window.addEventListener('packswift:planner-loaded', restored);
})();

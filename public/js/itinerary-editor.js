/* Explicit, editable itinerary state. Re-mounting never generates or replaces a plan. */
(() => {
  'use strict';
  const element = (tag, text, className) => {
    const result = document.createElement(tag);
    if (text !== undefined) result.textContent = text;
    if (className) result.className = className;
    return result;
  };
  const button = (text, action, className) => {
    const result = element('button', text, className);
    result.type = 'button';
    result.addEventListener('click', action);
    return result;
  };
  const model = () => window.PackSwiftItineraryPlanModel;
  const clone = value => JSON.parse(JSON.stringify(value));
  let host, field, current = { input: {}, selected: [] }, plan = null;
  let fieldSnapshot = null, renderSignature = '', activeDay = 1, history = [];
  let busy = false, error = '', message = '', request = null, requestVersion = 0;
  let retryDay = null, openDialog = null;

  function ensureField() {
    field = document.getElementById('itinerary-plan-state') || field;
    if (!field) {
      field = element('input');
      field.type = 'hidden';
      field.id = 'itinerary-plan-state';
      field.name = 'itineraryPlan';
      field.setAttribute('form', 'trip-planner-form');
      const parent = document.getElementById('trip-planner-form') || document.body;
      if (parent) parent.append(field);
    }
    const parent = document.getElementById('trip-planner-form') || document.body;
    if (parent && field.parentNode !== parent) parent.append(field);
    return field;
  }
  function context() { return model()?.context(current.input) || ''; }
  function sourceSignature() {
    return JSON.stringify([context(), current.selected.map(place => [place.providerPlaceId || place.placeId || place.id || '', place.title || place.name || ''])]);
  }
  function isOutdated() { return !!plan && plan.contextKey !== context(); }
  function readField() {
    ensureField();
    if (!model() || field.value === fieldSnapshot) return false;
    const raw = field.value;
    fieldSnapshot = raw;
    plan = model().normalize(raw);
    history = [];
    error = raw && !plan ? 'The saved itinerary could not be read. Build a new itinerary to continue.' : '';
    message = '';
    if (request) { request.abort(); request = null; busy = false; requestVersion++; }
    if (openDialog) openDialog.close();
    return true;
  }
  function persist() {
    const saved = plan && typeof model().persist === 'function' ? model().persist(plan) : plan;
    field.value = plan ? JSON.stringify(saved) : '';
    fieldSnapshot = field.value;
    field.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function commit(next, notice, remember = true) {
    if (remember) history.push(plan ? clone(plan) : null);
    history = history.slice(-20);
    plan = next;
    error = '';
    message = notice || 'Itinerary updated. You can undo this change.';
    persist();
    render();
  }
  function change(action, notice) {
    if (!plan || busy) return false;
    try { commit(model().edit(plan, action), notice); return true; }
    catch (failure) { error = failure.message || 'This change could not be applied.'; render(); return false; }
  }
  function locate(id) {
    if (!plan) return null;
    for (const day of plan.days) {
      const stop = day.stops.find(item => item.id === id);
      if (stop) return { stop, day };
    }
    const stop = (plan.unscheduled || []).find(item => item.id === id);
    return stop ? { stop, day: null } : null;
  }
  function minutes(value) {
    if (!Number.isFinite(Number(value)) || value === null || value === '') return 'time unknown';
    const rounded = Math.max(0, Math.round(Number(value)));
    return rounded < 60 ? rounded + ' min' : Math.floor(rounded / 60) + ' hr' + (rounded % 60 ? ' ' + rounded % 60 + ' min' : '');
  }
  function money(value, currency) {
    try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 2 }).format(value); }
    catch { return Number(value).toFixed(2) + ' ' + (currency || ''); }
  }
  function dateLabel(value) {
    const date = new Date(value + 'T12:00:00Z');
    return Number.isNaN(date.getTime()) ? value || '' : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date);
  }
  function coordinate(stop) {
    const c = stop?.coordinates;
    if (!c || !Number.isFinite(c.latitude) || !Number.isFinite(c.longitude) || Math.abs(c.latitude) > 90 || Math.abs(c.longitude) > 180) return null;
    return c.latitude + ',' + c.longitude;
  }
  function directions(stops, label = 'Open route in Google Maps') {
    if (stops.length < 2 || stops.length > 10 || stops.some(stop => !coordinate(stop))) return null;
    const mode = String(stops[1].routeFromPrevious?.mode || current.input.itineraryTransport || 'TRANSIT').toLowerCase();
    const travelmode = /walk/.test(mode) ? 'walking' : /driv|car|taxi/.test(mode) ? 'driving' : /bicycl|cycl/.test(mode) ? 'bicycling' : 'transit';
    const params = new URLSearchParams({ api: '1', origin: coordinate(stops[0]), destination: coordinate(stops[stops.length - 1]), travelmode });
    if (stops.length > 2) params.set('waypoints', stops.slice(1, -1).map(coordinate).join('|'));
    const link = element('a', label, 'itinerary-editor-link');
    link.href = 'https://www.google.com/maps/dir/?' + params;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', label + ' (opens in a new tab)');
    return link;
  }
  function modal(title, build) {
    if (openDialog) openDialog.close();
    const trigger = document.activeElement;
    const triggerStopId = trigger?.closest?.('[data-stop-id]')?.dataset.stopId;
    const dialog = element('dialog', undefined, 'itinerary-editor-dialog');
    const heading = element('h3', title);
    heading.id = 'itinerary-editor-dialog-heading';
    dialog.setAttribute('aria-labelledby', heading.id);
    const close = button('Close', () => dialog.close(), 'itinerary-editor-close');
    dialog.append(heading, close);
    dialog.addEventListener('input', event => event.stopPropagation());
    dialog.addEventListener('change', event => event.stopPropagation());
    build(dialog);
    document.body.append(dialog);
    openDialog = dialog;
    dialog.addEventListener('close', () => {
      if (openDialog === dialog) openDialog = null;
      dialog.remove();
      if (openDialog) return;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
      else if (host?.isConnected) {
        const card = [...host.querySelectorAll('[data-stop-id]')].find(item => item.dataset.stopId === triggerStopId);
        const next = card ? [...card.querySelectorAll('button')].find(item => item.textContent === trigger?.textContent) : host.querySelector('button');
        next?.focus({ preventScroll: true });
      }
    }, { once: true });
    dialog.showModal();
    return dialog;
  }
  function confirmUnlocked(id, proceed) {
    const found = locate(id);
    if (!found) return;
    if (!found.stop.locked) { proceed(found); return; }
    modal('Unlock this fixed stop?', dialog => {
      dialog.append(element('p', '“' + found.stop.name + '” is kept fixed. Unlock it before changing, moving, replacing or removing it.'));
      const actions = element('div', undefined, 'itinerary-editor-actions');
      actions.append(button('Keep fixed', () => dialog.close()), button('Unlock and continue', () => {
        dialog.close();
        change({ type: 'lock', id, locked: false }, 'Stop unlocked.');
        const latest = locate(id);
        if (latest) proceed(latest);
      }, 'itinerary-editor-primary'));
      dialog.append(actions);
    });
  }
  function labeledInput(parent, title, type, value, options = {}) {
    const label = element('label', title), input = element(type === 'textarea' ? 'textarea' : 'input');
    if (type !== 'textarea') input.type = type;
    input.value = value ?? '';
    Object.assign(input, options);
    label.append(input);
    parent.append(label);
    return input;
  }
  function stopForm(id, kind) {
    const found = id ? locate(id) : null;
    const stop = found?.stop;
    const title = id ? 'Edit ' + stop.name : 'Add a personal stop';
    modal(title, dialog => {
      const form = element('form', undefined, 'itinerary-editor-form');
      form.addEventListener('submit', event => event.preventDefault());
      const name = labeledInput(form, 'Stop name', 'text', stop?.name || (kind === 'meal' ? 'Meal break' : kind === 'rest' ? 'Rest break' : ''), { required: true, maxLength: 200 });
      const pair = element('div', undefined, 'itinerary-editor-pair');
      const startTime = labeledInput(pair, 'Start time (local)', 'time', stop?.startTime || '12:00', { required: true });
      const duration = labeledInput(pair, 'Duration (minutes)', 'number', stop?.durationMinutes || (kind === 'rest' ? 30 : 60), { min: '5', max: '1440', step: '5', required: true });
      form.append(pair);
      const cost = labeledInput(form, 'Estimated cost (' + (stop?.currency || plan.currency || 'trip currency') + ')', 'number', stop?.costAmount, { min: '0', max: '100000000', step: '0.01' });
      cost.placeholder = 'Leave blank if unknown';
      const notes = labeledInput(form, 'Notes (optional)', 'textarea', stop?.notes || '', { maxLength: 600, rows: 3 });
      const status = element('p', '', 'itinerary-editor-notice');
      status.setAttribute('role', 'alert');
      const actions = element('div', undefined, 'itinerary-editor-actions');
      const submit = element('button', id ? 'Save changes' : 'Add to Day ' + activeDay, 'itinerary-editor-primary');
      submit.type = 'submit';
      actions.append(button('Cancel', () => dialog.close()), submit);
      form.append(status, actions);
      form.addEventListener('submit', () => {
        if (!form.reportValidity() || !name.value.trim()) return;
        if (id && !locate(id)) { status.textContent = 'This stop is no longer in the itinerary.'; return; }
        const values = { startTime: startTime.value, durationMinutes: Number(duration.value), costAmount: cost.value === '' ? null : Number(cost.value) };
        if (!id || name.value.trim() !== stop.name) values.name = name.value.trim();
        if (!id || notes.value.trim() !== (stop.notes || '')) values.notes = notes.value.trim();
        const changed = id ? change({ type: 'update', id, values }) : change({ type: 'add', day: activeDay, stop: { ...values, id: 'custom-' + crypto.randomUUID(), custom: true, locked: false, kind: kind || 'custom', currency: plan.currency, userEditedName: true } });
        if (changed) dialog.close();
        else status.textContent = error;
      });
      dialog.append(form);
    });
  }
  function moveStop(id) {
    confirmUnlocked(id, ({ stop, day }) => modal('Move ' + stop.name, dialog => {
      const label = element('label', 'Choose a day'), select = element('select');
      plan.days.forEach(item => select.append(new Option('Day ' + item.day + ' · ' + dateLabel(item.date), String(item.day))));
      select.value = String(day?.day || activeDay);
      label.append(select);
      dialog.append(label, element('p', 'The stop will be placed at the end of that day. Review its start time and travel time after moving.'));
      const actions = element('div', undefined, 'itinerary-editor-actions');
      actions.append(button('Cancel', () => dialog.close()), button('Move stop', () => {
        change({ type: 'move', id, day: Number(select.value) });
        activeDay = Number(select.value);
        dialog.close();
        render();
      }, 'itinerary-editor-primary'));
      dialog.append(actions);
    }));
  }
  function replacementStop(place, old) {
    const placeId = String(place.providerPlaceId || place.placeId || place.id || '');
    return { id: 'stop-' + crypto.randomUUID(), placeId, providerPlaceId: placeId, source: place.source, provider: place.provider === 'google' || place.source === 'user_search' ? 'google' : place.provider, name: place.title || place.name || 'Selected place', kind: 'activity', startTime: old.startTime, durationMinutes: Number(place.durationMinutes) || Number(place.suggestedStayMin) || old.durationMinutes || 60, coordinates: place.coordinates, costAmount: null, currency: plan.currency, locked: false, custom: false };
  }
  function replaceStop(id) {
    confirmUnlocked(id, ({ stop, day }) => modal('Replace ' + stop.name, dialog => {
      const used = new Set([...plan.days.flatMap(item => item.stops), ...(plan.unscheduled || [])].map(item => String(item.placeId || item.providerPlaceId || item.id)));
      const options = current.selected.filter(place => !used.has(String(place.providerPlaceId || place.placeId || place.id || '')) && !place.needsRefresh);
      dialog.append(element('p', 'Choose an unused place from your shortlist. Its cost stays unknown until you enter a confirmed estimate.'));
      const list = element('div', undefined, 'itinerary-editor-replacements');
      if (!options.length) list.append(element('p', 'No unused shortlist places are available. Add another place in the search above, or review a rebuilt day.'));
      options.forEach(place => list.append(button(place.title || place.name || 'Selected place', () => {
        change({ type: 'replace', id, stop: replacementStop(place, stop) });
        dialog.close();
      })));
      dialog.append(list);
      if (day) {
        const rebuild = button('Review a rebuilt Day ' + day.day, () => { dialog.close(); generate(day.day); });
        rebuild.disabled = isOutdated();
        dialog.append(rebuild);
      }
    }));
  }
  function removeStop(id) {
    confirmUnlocked(id, ({ stop }) => modal('Remove this stop?', dialog => {
      dialog.append(element('p', 'Remove “' + stop.name + '” from this itinerary? Your shortlist will not change.'));
      const actions = element('div', undefined, 'itinerary-editor-actions');
      actions.append(button('Keep stop', () => dialog.close()), button('Remove stop', () => { change({ type: 'remove', id }); dialog.close(); }));
      dialog.append(actions);
    }));
  }
  function warningList(parent, items, title) {
    const unique = [...new Set((items || []).filter(item => typeof item === 'string' && item))];
    if (!unique.length) return;
    const details = element('details', undefined, 'itinerary-editor-warnings');
    details.append(element('summary', title + ' (' + unique.length + ')'));
    const list = element('ul');
    unique.forEach(item => list.append(element('li', item)));
    details.append(list);
    parent.append(details);
  }
  function dailySummary(day) {
    const group = element('div', undefined, 'itinerary-editor-totals');
    const known = day.stops.filter(stop => Number.isFinite(stop.costAmount));
    const byCurrency = new Map();
    known.forEach(stop => { const c = stop.currency || plan.currency; byCurrency.set(c, (byCurrency.get(c) || 0) + stop.costAmount); });
    const cost = [...byCurrency].map(([currency, amount]) => money(amount, currency)).join(' + ');
    group.append(element('span', 'Known stop costs: ' + (cost || 'none yet')));
    const unknown = day.stops.length - known.length;
    if (unknown) group.append(element('span', unknown + ' stop cost' + (unknown === 1 ? '' : 's') + ' unknown'));
    const routes = day.stops.filter(stop => stop.placeId || coordinate(stop)).slice(1).map(stop => stop.routeFromPrevious);
    const measured = routes.filter(route => route && route.durationMinutes !== null && Number.isFinite(route.durationMinutes));
    const walking = measured.filter(route => /walk/i.test(route.mode || ''));
    group.append(element('span', 'Travel: ' + (measured.length ? minutes(measured.reduce((total, route) => total + route.durationMinutes, 0)) : 'unknown')));
    group.append(element('span', 'Walking: ' + (walking.length ? minutes(walking.reduce((total, route) => total + route.durationMinutes, 0)) : 'not estimated')));
    if (routes.length > measured.length) group.append(element('span', (routes.length - measured.length) + ' journey time(s) unknown'));
    if (measured.some(route => route.source !== 'routes')) group.append(element('small', 'Travel totals include estimates; check live directions.'));
    return group;
  }
  function stopCard(stop, day, index) {
    const card = element('li', undefined, 'itinerary-editor-stop');
    card.dataset.stopId = stop.id;
    const previousLocated = day && [...day.stops.slice(0, index)].reverse().find(item => item.placeId || coordinate(item));
    if (previousLocated && (stop.placeId || coordinate(stop))) {
      const route = stop.routeFromPrevious;
      const text = route && route.durationMinutes !== null && Number.isFinite(route.durationMinutes) ? minutes(route.durationMinutes) + ' · ' + (route.mode || 'travel') + (route.source === 'routes' ? ' · route time' : ' · estimate') : 'Travel time unknown — check directions';
      const leg = element('div', text, 'itinerary-editor-leg');
      const link = directions([previousLocated, stop], 'Directions from ' + previousLocated.name);
      if (link) leg.append(link);
      card.append(leg);
    }
    const body = element('article', undefined, 'itinerary-editor-stop-body');
    const heading = element('div', undefined, 'itinerary-editor-stop-heading');
    heading.append(element('span', stop.startTime || 'Time flexible', 'itinerary-editor-time'), element('h4', stop.name || 'Untitled stop'));
    if (stop.locked) heading.append(element('span', 'Kept fixed', 'itinerary-editor-badge'));
    else if (stop.userEdited) heading.append(element('span', 'Edited', 'itinerary-editor-badge'));
    body.append(heading, element('p', [minutes(stop.durationMinutes), stop.kind || 'activity', Number.isFinite(stop.costAmount) ? money(stop.costAmount, stop.currency || plan.currency) : 'Cost unknown'].join(' · '), 'itinerary-editor-meta'));
    if (stop.notes) body.append(element('p', stop.notes, 'itinerary-editor-notes'));
    warningList(body, stop.warnings, 'Check this stop');
    const actions = element('div', undefined, 'itinerary-editor-actions');
    actions.append(button('Edit', () => confirmUnlocked(stop.id, () => stopForm(stop.id))), button('Move / day', () => moveStop(stop.id)));
    if (day) {
      const up = button('↑ Up', () => confirmUnlocked(stop.id, () => change({ type: 'reorder', id: stop.id, direction: -1 })));
      const down = button('↓ Down', () => confirmUnlocked(stop.id, () => change({ type: 'reorder', id: stop.id, direction: 1 })));
      up.disabled = index === 0;
      down.disabled = index === day.stops.length - 1;
      up.setAttribute('aria-label', 'Move ' + stop.name + ' earlier');
      down.setAttribute('aria-label', 'Move ' + stop.name + ' later');
      actions.append(up, down);
    }
    actions.append(button('Replace', () => replaceStop(stop.id)), button('Remove', () => removeStop(stop.id)));
    const lock = button(stop.locked ? 'Unlock' : 'Keep fixed', () => {
      if (stop.locked) confirmUnlocked(stop.id, () => {});
      else change({ type: 'lock', id: stop.id, locked: true }, 'Stop kept fixed during future rebuilds.');
    });
    lock.setAttribute('aria-pressed', String(stop.locked));
    actions.append(lock);
    actions.querySelectorAll('button').forEach(control => { if (busy) control.disabled = true; });
    body.append(actions);
    card.append(body);
    return card;
  }
  function preview(next, rebuildDay) {
    modal(rebuildDay ? 'Review rebuilt Day ' + rebuildDay : 'Review your updated itinerary', dialog => {
      dialog.append(element('p', 'Your current itinerary is unchanged until you accept this preview. Fixed stops are preserved by the planner.'));
      const days = rebuildDay ? next.days.filter(day => day.day === rebuildDay) : next.days;
      const list = element('div', undefined, 'itinerary-editor-preview');
      for (const day of days) {
        const section = element('section');
        section.append(element('h4', 'Day ' + day.day + ' · ' + dateLabel(day.date)));
        const before = plan.days.find(item => item.day === day.day);
        if (before) section.append(element('p', before.stops.length + ' current stop(s) → ' + day.stops.length + ' proposed stop(s)', 'itinerary-editor-intro'));
        const stops = element('ol');
        day.stops.forEach(stop => stops.append(element('li', (stop.startTime || 'Flexible') + ' · ' + stop.name + ' · ' + minutes(stop.durationMinutes) + ' · ' + (Number.isFinite(stop.costAmount) ? money(stop.costAmount, stop.currency || next.currency) : 'Cost unknown') + (stop.locked ? ' · Kept fixed' : ''))));
        if (!day.stops.length) section.append(element('p', 'Flexible day — no scheduled stops.'));
        section.append(stops);
        warningList(section, day.warnings, 'Day checks');
        list.append(section);
      }
      dialog.append(list);
      warningList(dialog, next.warnings, 'Planning checks');
      warningList(dialog, next.assumptions, 'Assumptions');
      const actions = element('div', undefined, 'itinerary-editor-actions');
      actions.append(button('Keep current itinerary', () => dialog.close()), button('Accept ' + (rebuildDay ? 'rebuilt day' : 'updated itinerary'), () => {
        if (next.contextKey !== context()) { dialog.close(); error = 'Trip details changed while you reviewed this preview. Build again to use the latest details.'; render(); return; }
        commit(next, rebuildDay ? 'Day ' + rebuildDay + ' updated. Other days are unchanged.' : 'Your updated itinerary is ready.');
        dialog.close();
      }, 'itinerary-editor-primary'));
      dialog.append(actions);
    });
  }
  async function generate(rebuildDay = null) {
    if (busy || !model()) return;
    if (!current.input.destination || !current.input.startDate || !current.input.endDate) { error = 'Choose a destination and trip dates before building your itinerary.'; render(); return; }
    if (rebuildDay !== null && isOutdated()) { error = 'Trip details changed. Review a full updated itinerary before rebuilding one day.'; render(); return; }
    const signature = sourceSignature(), version = ++requestVersion;
    const body = { input: clone(current.input), selected: clone(current.selected), previousPlan: plan ? clone(plan) : null, rebuildDay };
    delete body.input.itineraryPlan;
    request = new AbortController();
    busy = true;
    error = '';
    message = '';
    retryDay = rebuildDay;
    render();
    try {
      const response = await fetch('/api/itinerary-plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: request.signal });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || data.error || 'The itinerary could not be built. Please try again.');
      if (version !== requestVersion) return;
      if (signature !== sourceSignature()) throw new Error('Trip details or selected places changed while planning. Your itinerary has not been replaced. Try again with the latest details.');
      const next = model().normalize(data.plan);
      if (!next) throw new Error('The planner returned an unreadable itinerary. Please try again.');
      next.warnings = [...new Set([...(next.warnings || []), ...(Array.isArray(data.warnings) ? data.warnings : [])])];
      busy = false;
      request = null;
      if (plan) { render(); preview(next, rebuildDay); }
      else commit(next, 'Your itinerary is ready. Review times, costs and travel checks before booking.');
    } catch (failure) {
      if (version !== requestVersion) return;
      if (failure.name !== 'AbortError') error = failure.message || 'The itinerary could not be built. Please try again.';
    } finally {
      if (version === requestVersion) { busy = false; request = null; render(); }
    }
  }
  function render() {
    if (!host || !model()) return;
    const signature = JSON.stringify([fieldSnapshot, context(), sourceSignature(), activeDay, busy, error, message, history.length]);
    if (signature === renderSignature) return;
    renderSignature = signature;
    host.replaceChildren();
    const header = element('div', undefined, 'itinerary-editor-header');
    header.append(element('h3', 'Your day-by-day itinerary'));
    if(!plan)header.append(element('p', 'Build a suggested plan, then edit it your way.', 'itinerary-editor-intro'));
    host.append(header);
    const actions = element('div', undefined, 'itinerary-editor-actions');
    const build = button(busy ? 'Building your itinerary…' : plan ? 'Review updated itinerary' : 'Build my itinerary', () => generate(), 'itinerary-editor-primary');
    build.disabled = busy;
    actions.append(build);
    if (history.length) {
      const undo = button('Undo last change', () => { const last = history.pop(); commit(last, 'Last change undone.', false); });
      undo.disabled = busy;
      actions.append(undo);
    }
    if (busy) actions.append(button('Cancel', () => { request?.abort(); request = null; requestVersion++; busy = false; message = 'Planning cancelled. Your itinerary is unchanged.'; render(); }));
    host.append(actions);
    const status = element('p', busy ? 'Arranging stops and checking available travel information…' : error || message, 'itinerary-editor-status');
    status.setAttribute('role', error ? 'alert' : 'status');
    status.setAttribute('aria-live', error ? 'assertive' : 'polite');
    if (error) status.classList.add('is-error');
    if (status.textContent) host.append(status);
    if (error && !busy) host.append(button('Try again', () => generate(retryDay)));
    if (!plan) {
      host.append(element('p', 'Your selected places, trip pace and arrival details will shape a practical first draft. Nothing is booked, and uncertain costs or travel times remain clearly marked.', 'itinerary-editor-empty'));
      return;
    }
    if (isOutdated()) host.append(element('p', 'Trip details have changed. Your itinerary is unchanged; review an updated itinerary when you’re ready.', 'itinerary-editor-notice'));
    host.append(element('p', [plan.destination, dateLabel(plan.startDate) + '–' + dateLabel(plan.endDate)].filter(Boolean).join(' · '), 'itinerary-editor-intro'));
    const warnings = [...(plan.warnings || [])];
    try { warnings.push(...model().validate(plan, current.input)); } catch { /* The saved plan remains editable even if validation is unavailable. */ }
    const checks=element('div',undefined,'itinerary-editor-checks');
    warningList(checks, warnings, 'Trip checks');
    warningList(checks, plan.assumptions, 'Planning assumptions');
    if (!plan.days.some(day => day.day === activeDay)) activeDay = plan.days[0]?.day || 1;
    const tabs = element('div', undefined, 'itinerary-editor-tabs');
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', 'Itinerary days');
    plan.days.forEach((day, index) => {
      const tab = button('Day ' + day.day + ' · ' + dateLabel(day.date), () => { activeDay = day.day; render(); document.getElementById('itinerary-editor-tab-' + activeDay)?.focus({ preventScroll: true }); });
      tab.id = 'itinerary-editor-tab-' + day.day;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', String(activeDay === day.day));
      tab.setAttribute('aria-controls', 'itinerary-editor-day');
      tab.tabIndex = activeDay === day.day ? 0 : -1;
      tab.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? plan.days.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + plan.days.length) % plan.days.length;
        activeDay = plan.days[next].day;
        render();
        document.getElementById('itinerary-editor-tab-' + activeDay)?.focus({ preventScroll: true });
      });
      tabs.append(tab);
    });
    host.append(tabs);
    const day = plan.days.find(item => item.day === activeDay);
    if (day) {
      const panel = element('section', undefined, 'itinerary-editor-day');
      panel.id = 'itinerary-editor-day';
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', 'itinerary-editor-tab-' + day.day);
      panel.append(element('h4', day.title || 'Day ' + day.day));
      const summary=element('details',undefined,'itinerary-editor-warnings');summary.append(element('summary','Day costs & travel'),dailySummary(day));panel.append(summary);
      warningList(panel, day.warnings, 'Day checks');
      const located = day.stops.filter(stop => coordinate(stop));
      const route = directions(located, 'Map ' + located.length + ' located stops');
      if (route) panel.append(route);
      if (route && located.length < day.stops.length) panel.append(element('p', 'Map includes verified locations only.', 'itinerary-editor-intro'));
      const timeline = element('ol', undefined, 'itinerary-editor-timeline');
      day.stops.forEach((stop, index) => timeline.append(stopCard(stop, day, index)));
      panel.append(timeline);
      if (!day.stops.length) panel.append(element('p', 'A flexible day. Add a personal stop or move a place here.', 'itinerary-editor-empty'));
      const dayActions = element('div', undefined, 'itinerary-editor-actions');
      dayActions.append(button('+ Personal stop', () => stopForm(null, 'custom')), button('+ Meal', () => stopForm(null, 'meal')), button('+ Rest', () => stopForm(null, 'rest')));
      const rebuild = button('Rebuild Day ' + day.day, () => generate(day.day));
      rebuild.disabled = busy || isOutdated();
      if (isOutdated()) rebuild.title = 'Review an updated itinerary first because trip details changed.';
      dayActions.append(rebuild);
      if (busy) dayActions.querySelectorAll('button').forEach(control => { control.disabled = true; });
      panel.append(dayActions, element('p', 'Rebuilding previews one day before replacement. Stops you keep fixed stay protected.', 'itinerary-editor-intro'));
      host.append(panel);
    }
    if (plan.unscheduled?.length) {
      const details = element('details', undefined, 'itinerary-editor-unscheduled');
      details.append(element('summary', 'Unscheduled stops (' + plan.unscheduled.length + ')'));
      const list = element('ol', undefined, 'itinerary-editor-timeline');
      plan.unscheduled.forEach(stop => {
        const row = element('li', undefined, 'itinerary-editor-stop-body');
        row.append(element('h4', stop.name), element('p', stop.reason || 'Choose a day and review the timing before adding this stop.', 'itinerary-editor-intro'));
        const label = element('label', 'Add to day'), select = element('select');
        select.setAttribute('aria-label', 'Day for ' + stop.name);
        plan.days.forEach(day => select.append(new Option('Day ' + day.day + ' · ' + dateLabel(day.date), String(day.day))));
        select.value = String(activeDay);
        label.append(select);
        const actions = element('div', undefined, 'itinerary-editor-actions');
        const add = button('Add to day', () => {
          const selected = current.selected.find(place => String(place.providerPlaceId || place.placeId || place.id || '') === String(stop.placeId || stop.id));
          window.PackSwiftItineraryEditor.addPlace(selected || { ...stop, placeId: stop.placeId || stop.id }, Number(select.value));
        });
        add.disabled = busy;
        const remove = button('Remove', () => modal('Remove unscheduled stop?', dialog => {
          dialog.append(element('p', 'Remove “' + stop.name + '” from this itinerary? Your shortlist is unchanged.'));
          dialog.append(button('Remove stop', () => { const next = clone(plan); next.unscheduled = next.unscheduled.filter(item => item.id !== stop.id);next.removedPlaceIds=[...new Set([...(next.removedPlaceIds||[]),String(stop.placeId||stop.id)])];commit(model().normalize(next)); dialog.close(); }));
        }));
        remove.disabled = busy;
        actions.append(add, remove);
        row.append(label, actions);
        list.append(row);
      });
      details.append(list);
      host.append(details);
    }
    const footer = element('div', undefined, 'itinerary-editor-actions');
    footer.append(button('Save planning', () => document.getElementById('studio-save')?.click(), 'itinerary-editor-primary'));
    host.append(checks,footer);
  }
  function restore() { if (readField()) { renderSignature = ''; render(); } }
  ensureField();
  if (!document.body) document.addEventListener('DOMContentLoaded', ensureField, { once: true });
  window.addEventListener('packswift:planner-loaded', restore);
  window.addEventListener('packswift:draft-restored', restore);
  window.PackSwiftItineraryEditor = {
    mount(parent, input, selected) {
      current = { input: input || {}, selected: Array.isArray(selected) ? selected : [] };
      ensureField();
      if (!host) {
        host = element('section', undefined, 'itinerary-editor');
        host.setAttribute('aria-label', 'Editable day-by-day itinerary');
        host.addEventListener('change', event => event.stopPropagation());
        host.addEventListener('input', event => event.stopPropagation());
      }
      readField();
      if (host.parentNode !== parent || parent.firstChild !== host) parent.prepend(host);
      render();
      return host;
    },
    getPlan() { return plan ? clone(plan) : null; },
    restorePlan(raw) {
      // A late background hydration response must not interrupt a build or an
      // unsaved edit/preview dialog, even when the saved field is unchanged.
      if (busy || openDialog) return false;
      const restored = model()?.normalize(raw);
      if (!restored) return false;
      ensureField();
      history = [];
      renderSignature = '';
      commit(restored, 'Saved itinerary restored. Review any unavailable place details before traveling.', false);
      return true;
    },
    addPlace(place, requestedDay) {
      if (!plan || busy || !place || place.needsRefresh) return false;
      const id = String(place.providerPlaceId || place.placeId || place.id || '');
      if (!id) return false;
      const all = plan.days.flatMap(day => day.stops);
      if (all.some(stop => String(stop.placeId || stop.providerPlaceId || '') === id)) return true;
      const dayNumber = plan.days.some(day => day.day === Number(requestedDay)) ? Number(requestedDay) : activeDay;
      const day = plan.days.find(item => item.day === dayNumber) || plan.days[0];
      if (!day) return false;
      const last = day.stops[day.stops.length - 1];
      let startTime = current.input.itineraryPreferences?.preferredDayStart || '09:00';
      if (last?.startTime && /^\d{2}:\d{2}$/.test(last.startTime)) {
        const time = last.startTime.split(':').map(Number);
        const end = Math.min(23 * 60 + 55, time[0] * 60 + time[1] + Number(last.durationMinutes || 60) + 30);
        startTime = String(Math.floor(end / 60)).padStart(2, '0') + ':' + String(end % 60).padStart(2, '0');
      }
      const stop = replacementStop(place, { startTime, durationMinutes: Number(place.suggestedStayMin) || 60 });
      activeDay = day.day;
      const base = clone(plan);
      base.unscheduled = base.unscheduled.filter(item => String(item.placeId || item.id) !== id);
      try {
        commit(model().edit(base, { type: 'add', day: day.day, stop }), 'Place added to Day ' + day.day + '. Review its timing and travel connection.');
        return true;
      } catch (failure) {
        error = failure.message || 'This place could not be added.';
        render();
        return false;
      }
    }
  };
})();

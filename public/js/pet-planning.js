(() => {
  const toggle = document.querySelector('[name="travelingWithPets"]');
  const select = document.getElementById('pet-type');
  const options = document.getElementById('pet-options');
  if (!toggle || !select) return;
  const panel = document.createElement('section');
  panel.className = 'pet-preparation';
  panel.setAttribute('aria-live', 'polite');
  document.getElementById('preview-snapshot').after(panel);
  const guidance = {
    dog: ['🐕 Dog', 'Pack a secure carrier or travel restraint, lead, waste bags, familiar food and water supplies. Confirm breed, size and weight restrictions with your carrier.'],
    cat: ['🐈 Cat', 'Prepare a secure ventilated carrier, familiar bedding, litter supplies and usual food. Confirm carrier dimensions and cabin or cargo arrangements.'],
    rabbit: ['🐇 Rabbit', 'Ask a rabbit-experienced vet about journey suitability. Plan hay, water, familiar bedding and temperature-safe transport; many carriers do not accept rabbits.'],
    bird: ['🐦 Pet bird', 'Confirm the exact species is permitted before booking. Prepare an escape-proof travel enclosure and discuss stress and temperature needs with an avian vet.'],
    'small-mammal': ['🐾 Small mammal', 'Give the carrier the exact species. Ask an experienced vet about a secure enclosure, feeding and temperature needs; acceptance can be very limited.'],
    other: ['🐾 Other animal', 'Identify the exact species first. Ask the destination authority and a specialist transporter about eligibility before making bookings.']
  };
  function node(tag, text) { const el = document.createElement(tag); el.textContent = text; return el; }
  function update() {
    options.hidden = !toggle.checked;
    select.disabled = !toggle.checked;
    select.required = toggle.checked;
    toggle.setAttribute('aria-expanded', String(toggle.checked));
    toggle.setAttribute('aria-controls', 'pet-options');
    panel.hidden = !toggle.checked;
    panel.replaceChildren();
    if (!toggle.checked) return;
    const chosen = guidance[select.value];
    panel.append(node('h3', chosen ? `${chosen[0]} · Travel essentials` : '🐾 Pet-friendly planning'));
    if (!chosen) { panel.append(node('p', 'Choose a pet type to see its preparation checklist.')); return; }
    panel.append(node('p', chosen[1]));
    const list = document.createElement('ul');
    [
      'Documents — confirm origin, transit and destination rules, including any identification, vaccination, health certificate, permit or quarantine requirements.',
      'Transport & stay — get explicit pet acceptance from each carrier and accommodation; check fees and restrictions.',
      'Care — arrange a pre-travel vet consultation, food, water, medication and an emergency veterinary contact.'
    ].forEach(text => list.append(node('li', text)));
    panel.append(list, node('small', 'Preparation reminders, not travel clearance. Requirements depend on species, route and travel date. Pet fees are not included in the trip estimate.'));
  }
  toggle.addEventListener('change', update);
  select.addEventListener('change', update);
  window.addEventListener('packswift:pets-restored', update);
  window.addEventListener('packswift:preview-results', update);
  update();
})();

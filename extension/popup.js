const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const container = document.getElementById("days");
const savedMsg = document.getElementById("saved");

function render(selected) {
  container.innerHTML = "";
  DAY_NAMES.forEach((name, idx) => {
    const row = document.createElement("div");
    row.className = "day-row";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.id = "day-" + idx;
    cb.checked = selected.includes(idx);
    cb.addEventListener("change", save);

    const label = document.createElement("label");
    label.htmlFor = "day-" + idx;
    label.textContent = name;

    row.appendChild(cb);
    row.appendChild(label);
    container.appendChild(row);
  });
}

function save() {
  const selected = [];
  DAY_NAMES.forEach((_, idx) => {
    const cb = document.getElementById("day-" + idx);
    if (cb && cb.checked) selected.push(idx);
  });
  chrome.storage.local.set({ [STORAGE_KEY_WORKDAYS]: selected }, () => {
    savedMsg.classList.add("show");
    setTimeout(() => savedMsg.classList.remove("show"), 1500);
  });
}

chrome.storage.local.get(STORAGE_KEY_WORKDAYS, (result) => {
  const workdays = result[STORAGE_KEY_WORKDAYS] || DEFAULT_WORKDAYS;
  render(workdays);
});

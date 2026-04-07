import type { WeaponProgressSnapshot } from "./Upgrades";

interface UIState {
  bugsFixed: number;
  currentBugCount: number;
  createdPerMinute: number;
  currentToolLabel: string;
  fixedPerMinute: number;
  pressureLabel: string;
  runtimeLabel: string;
  statusText: string;
}

export class UI {
  private readonly bugsFixedValue: HTMLElement;
  private readonly currentBugsValue: HTMLElement;
  private readonly pressureValue: HTMLElement;
  private readonly rateValue: HTMLElement;
  private readonly runtimeValue: HTMLElement;
  private readonly statusBanner: HTMLElement;
  private readonly weaponRail: HTMLElement;
  private readonly weaponSummaryValue: HTMLElement;

  constructor() {
    this.currentBugsValue = this.requireElement("current-bugs-value");
    this.bugsFixedValue = this.requireElement("bugs-fixed-value");
    this.rateValue = this.requireElement("rate-value");
    this.runtimeValue = this.requireElement("runtime-value");
    this.pressureValue = this.requireElement("pressure-value");
    this.statusBanner = this.requireElement("status-banner");
    this.weaponSummaryValue = this.requireElement("weapon-summary-value");
    this.weaponRail = this.requireElement("weapon-rail");
  }

  render(state: UIState, snapshots: WeaponProgressSnapshot[]) {
    this.currentBugsValue.textContent = state.currentBugCount.toLocaleString();
    this.bugsFixedValue.textContent = state.bugsFixed.toLocaleString();
    this.rateValue.textContent = `+${state.createdPerMinute.toFixed(0)} created · -${state.fixedPerMinute.toFixed(0)} fixed`;
    this.runtimeValue.textContent = `${state.runtimeLabel} runtime`;
    this.pressureValue.textContent = state.pressureLabel;
    this.statusBanner.textContent = state.statusText;
    this.weaponSummaryValue.textContent = state.currentToolLabel;

    this.weaponRail.innerHTML = "";
    snapshots.forEach((snapshot) => {
      const card = document.createElement("article");
      card.className = [
        "rounded-[20px] border px-4 py-3 text-stone-100 shadow-[0_16px_36px_rgba(0,0,0,0.24)] backdrop-blur-xl transition duration-200",
        snapshot.current
          ? "border-sky-400/24 bg-sky-400/8"
          : "border-white/8 bg-zinc-950/74",
        snapshot.locked ? "opacity-60" : "",
      ].join(" ");
      card.innerHTML = `
        <div class="flex items-center justify-between gap-3">
          <span class="text-sm font-semibold text-stone-100">${snapshot.title}</span>
          <span class="text-[0.68rem] font-medium uppercase tracking-[0.14em] text-stone-500">${snapshot.locked ? "Locked" : snapshot.current ? "Active" : "Ready"}</span>
        </div>
        <p class="mt-2 text-sm leading-5 text-stone-300">${snapshot.detail}</p>
        <div class="mt-3 text-[0.68rem] font-medium uppercase tracking-[0.14em] text-stone-500">${snapshot.progressText}</div>
      `;
      this.weaponRail.appendChild(card);
    });
  }

  private requireElement(id: string) {
    const element = document.getElementById(id);
    if (!element) {
      throw new Error(`Element #${id} was not found`);
    }

    return element;
  }
}
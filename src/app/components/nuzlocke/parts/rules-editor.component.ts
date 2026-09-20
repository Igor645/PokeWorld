import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RULE_LABELS, RULE_PRESETS, Rules } from '../models';

@Component({
  selector: 'nz-rules-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="nz-presets">
      @for (p of presets; track p.id) {
        <button type="button" class="nz-preset" [class.nz-preset-on]="activePreset() === p.id" (click)="changed.emit(p.rules)">
          <strong>{{ p.label }}</strong><span>{{ p.blurb }}</span>
        </button>
      }
    </div>
    <ul class="nz-toggles">
      @for (k of keys(); track k) {
        <li>
          <label class="nz-toggle">
            <input type="checkbox" [checked]="rules()[k]" (change)="toggle(k, $any($event.target).checked)">
            <span class="nz-toggle-ui" aria-hidden="true"></span>
            <span class="nz-toggle-text"><strong>{{ labels[k].label }}</strong><span>{{ labels[k].hint }}</span></span>
          </label>
        </li>
      }
    </ul>
  `,
})
export class RulesEditorComponent {
  readonly rules = input.required<Rules>();
  readonly soullink = input(false);
  readonly changed = output<Partial<Rules>>();

  protected readonly presets = RULE_PRESETS;
  protected readonly labels = RULE_LABELS;

  protected readonly keys = computed(() =>
    (Object.keys(RULE_LABELS) as (keyof Rules)[]).filter(k => !RULE_LABELS[k].soulOnly || this.soullink()));

  protected toggle(key: keyof Rules, value: boolean): void {
    this.changed.emit({ [key]: value });
  }

  protected readonly activePreset = computed(() => {
    const rules = this.rules();
    const keys = Object.keys(rules) as (keyof Rules)[];
    return RULE_PRESETS.find(p => keys.every(k => p.rules[k] === rules[k]))?.id ?? '';
  });
}

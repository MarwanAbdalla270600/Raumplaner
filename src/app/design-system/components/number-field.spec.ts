import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LengthUnit } from '../../core/domain/units';
import { NumberFieldComponent } from './number-field';

@Component({
  imports: [NumberFieldComponent],
  template: `<ds-number-field
    label="Breite"
    [unit]="unit()"
    [value]="value()"
    [min]="1"
    [max]="500"
    (valueChange)="changes.push($event)"
  />`,
})
class HostComponent {
  readonly unit = signal<LengthUnit>('cm');
  readonly value = signal(250);
  readonly changes: number[] = [];
}

describe('NumberFieldComponent', () => {
  async function setup() {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    return { fixture, host: fixture.componentInstance, input };
  }

  function commit(input: HTMLInputElement, value: string): void {
    input.value = value;
    input.dispatchEvent(new Event('change'));
  }

  it('associates the label with the input', async () => {
    const { fixture, input } = await setup();
    const label = fixture.nativeElement.querySelector('label') as HTMLLabelElement;
    expect(label.htmlFor).toBe(input.id);
    expect(label.textContent).toContain('Breite');
  });

  it('displays and emits values in the selected unit', async () => {
    const { fixture, host, input } = await setup();
    host.unit.set('m');
    await fixture.whenStable();
    expect(input.value).toBe('2,5');

    commit(input, '3,2');
    expect(host.changes).toEqual([320]);
  });

  it('clamps to min/max and ignores invalid input', async () => {
    const { host, input } = await setup();
    commit(input, '9999');
    commit(input, 'abc');
    expect(host.changes).toEqual([500]);
  });

  it('steps with the arrow keys', async () => {
    const { host, input } = await setup();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    expect(host.changes).toEqual([251]);
  });

  it('does not emit when the value is unchanged', async () => {
    const { host, input } = await setup();
    commit(input, '250');
    expect(host.changes).toEqual([]);
  });
});

import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TabsComponent } from './tabs';

@Component({
  imports: [TabsComponent],
  template: `<ds-tabs label="Bereiche" [tabs]="tabs" [(selected)]="selected" />`,
})
class HostComponent {
  readonly tabs = [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
    { id: 'c', label: 'C' },
  ];
  readonly selected = signal('a');
}

describe('TabsComponent', () => {
  it('implements the ARIA tabs pattern with roving tabindex and arrow keys', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const tabs = Array.from(fixture.nativeElement.querySelectorAll('[role=tab]')) as HTMLButtonElement[];

    expect(tabs.map((tab) => tab.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']);
    expect(tabs.map((tab) => tab.tabIndex)).toEqual([0, -1, -1]);

    tabs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    await fixture.whenStable();
    expect(fixture.componentInstance.selected()).toBe('c');

    tabs[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    await fixture.whenStable();
    expect(fixture.componentInstance.selected()).toBe('a');
  });
});

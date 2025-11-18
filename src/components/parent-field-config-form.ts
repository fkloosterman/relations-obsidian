import { Setting } from 'obsidian';
import { ParentFieldConfig, SectionConfig } from '../types';

/**
 * Component for editing a single parent field configuration.
 *
 * Provides a comprehensive form interface for configuring:
 * - Field name and display name
 * - Ancestors section configuration
 * - Descendants section configuration
 * - Siblings section configuration
 *
 * Features:
 * - Collapsible form sections
 * - Real-time validation
 * - Change callbacks
 * - Remove and duplicate actions
 */
export class ParentFieldConfigForm {
  private containerEl: HTMLElement;
  private config: ParentFieldConfig;
  private onChange: (config: ParentFieldConfig) => void;
  private onRemove: () => void;
  private onDuplicate: () => void;
  private onCollapsedChange?: (collapsed: boolean) => void;
  private collapsed: boolean = true;
  private formEl: HTMLElement | null = null;

  constructor(
    containerEl: HTMLElement,
    config: ParentFieldConfig,
    onChange: (config: ParentFieldConfig) => void,
    onRemove: () => void,
    onDuplicate: () => void,
    initialCollapsed: boolean = true,
    onCollapsedChange?: (collapsed: boolean) => void
  ) {
    this.containerEl = containerEl;
    this.config = config;
    this.onChange = onChange;
    this.onRemove = onRemove;
    this.onDuplicate = onDuplicate;
    this.collapsed = initialCollapsed;
    this.onCollapsedChange = onCollapsedChange;
  }

  /**
   * Renders the configuration form.
   */
  render(): void {
    this.formEl = this.containerEl.createDiv('parent-field-config');

    // Header with collapse toggle
    this.renderHeader(this.formEl);

    // Body (collapsible)
    const bodyEl = this.formEl.createDiv('parent-field-config-body');
    if (this.collapsed) {
      bodyEl.addClass('is-collapsed');
    }

    this.renderFieldSettings(bodyEl);

    // Ensure sectionOrder exists, or use default
    if (!this.config.sectionOrder) {
      this.config.sectionOrder = ['reference', 'roots', 'ancestors', 'descendants', 'siblings'];
    }

    // Render sections in the configured order
    this.config.sectionOrder.forEach((sectionKey, index) => {
      if (sectionKey === 'reference') {
        this.renderReferenceSection(bodyEl, index);
      } else if (sectionKey === 'roots' || sectionKey === 'ancestors' || sectionKey === 'descendants' || sectionKey === 'siblings') {
        const titleMap = {
          'roots': 'Roots Section',
          'ancestors': 'Ancestors Section',
          'descendants': 'Descendants Section',
          'siblings': 'Siblings Section'
        };
        this.renderSectionConfig(bodyEl, sectionKey, titleMap[sectionKey], index);
      }
    });

    this.renderActions(bodyEl);
  }

  /**
   * Renders the form header with title and remove button.
   */
  private renderHeader(formEl: HTMLElement): void {
    const headerEl = formEl.createDiv('parent-field-config-header');

    // Collapse icon
    const collapseIcon = headerEl.createSpan('collapse-icon');
    collapseIcon.setText(this.collapsed ? '▶' : '▼');
    collapseIcon.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleCollapse();
    });

    // Title
    const titleEl = headerEl.createSpan('config-title');
    titleEl.setText(`Field: "${this.config.name}"`);

    // Remove button
    const removeBtn = headerEl.createEl('button', {
      text: 'Remove',
      cls: 'mod-warning'
    });
    removeBtn.onclick = () => {
      this.onRemove();
    };

    headerEl.onclick = (e) => {
      // Only toggle if clicking the header itself, not buttons
      if (e.target === headerEl || e.target === collapseIcon || e.target === titleEl) {
        this.toggleCollapse();
      }
    };
  }

  /**
   * Renders field-level settings (name, display name).
   */
  private renderFieldSettings(containerEl: HTMLElement): void {
    const settingsEl = containerEl.createDiv('field-settings');

    new Setting(settingsEl)
      .setName('Field Name')
      .setDesc('The frontmatter field name (e.g., "parent", "project")')
      .addText(text => {
        text.setValue(this.config.name);
        text.setPlaceholder('parent');
        text.onChange(value => {
          this.config.name = value;
          this.updateTitle();
          this.onChange(this.config);
        });
      });

    new Setting(settingsEl)
      .setName('Display Name')
      .setDesc('Optional friendly name for UI (defaults to field name)')
      .addText(text => {
        text.setValue(this.config.displayName || '');
        text.setPlaceholder(this.config.name || 'Parent');
        text.onChange(value => {
          this.config.displayName = value || undefined;
          this.onChange(this.config);
        });
      });
  }

  /**
   * Renders configuration for a single section.
   */
  private renderSectionConfig(
    containerEl: HTMLElement,
    sectionKey: 'roots' | 'ancestors' | 'descendants' | 'siblings',
    sectionTitle: string,
    orderIndex: number
  ): void {
    const sectionEl = containerEl.createDiv('section-config');

    // Section header with reorder controls
    const headerEl = sectionEl.createDiv('section-header');

    const titleEl = headerEl.createEl('h4', { text: sectionTitle });

    // Reorder buttons container
    const reorderContainer = headerEl.createDiv('section-reorder-buttons');

    // Up arrow
    const upBtn = reorderContainer.createEl('button', {
      text: '↑',
      cls: 'clickable-icon'
    });
    upBtn.disabled = orderIndex === 0;
    upBtn.onclick = (e) => {
      e.preventDefault();
      this.moveSectionUp(orderIndex);
    };

    // Down arrow
    const downBtn = reorderContainer.createEl('button', {
      text: '↓',
      cls: 'clickable-icon'
    });
    downBtn.disabled = orderIndex === (this.config.sectionOrder?.length ?? 1) - 1;
    downBtn.onclick = (e) => {
      e.preventDefault();
      this.moveSectionDown(orderIndex);
    };

    const config = this.config[sectionKey];

    // Display name
    new Setting(sectionEl)
      .setName('Display Name')
      .setDesc('Name shown in sidebar')
      .addText(text => {
        text.setValue(config.displayName);
        text.setPlaceholder(sectionTitle);
        text.onChange(value => {
          config.displayName = value;
          this.onChange(this.config);
        });
      });

    // Visibility
    new Setting(sectionEl)
      .setName('Visible')
      .setDesc('Show this section in the sidebar')
      .addToggle(toggle => {
        toggle.setValue(config.visible);
        toggle.onChange(value => {
          config.visible = value;
          this.onChange(this.config);
        });
      });

    // Initial collapsed state
    new Setting(sectionEl)
      .setName('Initially Collapsed')
      .setDesc('Start with this section collapsed')
      .addToggle(toggle => {
        toggle.setValue(config.collapsed);
        toggle.onChange(value => {
          config.collapsed = value;
          this.onChange(this.config);
        });
      });

    // Section-specific settings
    if (sectionKey === 'ancestors' || sectionKey === 'descendants') {
      this.renderTreeSectionSettings(sectionEl, config);
    } else if (sectionKey === 'roots') {
      this.renderRootsSectionSettings(sectionEl, config);
    } else if (sectionKey === 'siblings') {
      this.renderSiblingSectionSettings(sectionEl, config);
    }
  }

  /**
   * Renders settings specific to tree sections (ancestors/descendants).
   */
  private renderTreeSectionSettings(containerEl: HTMLElement, config: SectionConfig): void {
    new Setting(containerEl)
      .setName('Max Depth')
      .setDesc('Maximum depth to traverse (leave empty for unlimited)')
      .addText(text => {
        text.setPlaceholder('5');
        text.setValue(config.maxDepth?.toString() || '');
        text.onChange(value => {
          if (value === '') {
            config.maxDepth = undefined;
          } else {
            const num = parseInt(value);
            config.maxDepth = isNaN(num) ? undefined : Math.max(0, num);
          }
          this.onChange(this.config);
        });
      });

    new Setting(containerEl)
      .setName('Initial Unfold Depth')
      .setDesc('How many levels to show expanded by default (minimum: 1)')
      .addText(text => {
        text.setPlaceholder('2');
        text.setValue(config.initialDepth?.toString() || '');
        text.onChange(value => {
          if (value === '') {
            config.initialDepth = undefined;
          } else {
            const num = parseInt(value);
            config.initialDepth = isNaN(num) ? undefined : Math.max(1, num);
          }
          this.onChange(this.config);
        });
      });
  }

  /**
   * Renders settings specific to siblings section.
   */
  private renderSiblingSectionSettings(containerEl: HTMLElement, config: SectionConfig): void {
    new Setting(containerEl)
      .setName('Sort Order')
      .setDesc('How to sort sibling items')
      .addDropdown(dropdown => {
        dropdown.addOption('alphabetical', 'Alphabetical');
        dropdown.addOption('created', 'Created Date');
        dropdown.addOption('modified', 'Modified Date');
        dropdown.setValue(config.sortOrder || 'alphabetical');
        dropdown.onChange(value => {
          config.sortOrder = value as 'alphabetical' | 'created' | 'modified';
          this.onChange(this.config);
        });
      });

    new Setting(containerEl)
      .setName('Include Self')
      .setDesc('Include the current file in siblings list')
      .addToggle(toggle => {
        toggle.setValue(config.includeSelf || false);
        toggle.onChange(value => {
          config.includeSelf = value;
          this.onChange(this.config);
        });
      });
  }
  /**
   * Renders settings specific to roots section.
   */
  private renderRootsSectionSettings(containerEl: HTMLElement, config: SectionConfig): void {
    new Setting(containerEl)
      .setName('Sort Order')
      .setDesc('How to sort root note items')
      .addDropdown(dropdown => {
        dropdown.addOption('alphabetical', 'Alphabetical');
        dropdown.addOption('created', 'Created Date');
        dropdown.addOption('modified', 'Modified Date');
        dropdown.setValue(config.sortOrder || 'alphabetical');
        dropdown.onChange(value => {
          config.sortOrder = value as 'alphabetical' | 'created' | 'modified';
          this.onChange(this.config);
        });
      });
  }


  /**
   * Renders action buttons (duplicate).
   */
  private renderActions(containerEl: HTMLElement): void {
    const actionsEl = containerEl.createDiv('config-actions');

    new Setting(actionsEl)
      .addButton(button => {
        button
          .setButtonText('Duplicate Field')
          .setTooltip('Create a copy of this field configuration')
          .onClick(() => {
            this.onDuplicate();
          });
      });
  }

  /**
   * Toggles collapse state of the form.
   */
  private toggleCollapse(): void {
    if (!this.formEl) return;

    this.collapsed = !this.collapsed;
    const bodyEl = this.formEl.querySelector('.parent-field-config-body') as HTMLElement;
    const icon = this.formEl.querySelector('.collapse-icon') as HTMLElement;

    if (bodyEl && icon) {
      if (this.collapsed) {
        bodyEl.addClass('is-collapsed');
        icon.setText('▶');
      } else {
        bodyEl.removeClass('is-collapsed');
        icon.setText('▼');
      }
    }

    // Notify parent of collapsed state change
    if (this.onCollapsedChange) {
      this.onCollapsedChange(this.collapsed);
    }
  }

  /**
   * Updates the title to reflect current field name.
   */
  private updateTitle(): void {
    if (!this.formEl) return;

    const titleEl = this.formEl.querySelector('.config-title');
    if (titleEl) {
      titleEl.setText(`Field: "${this.config.name}"`);
    }
  }

  /**
   * Renders the reference note section (current file display).
   */
  private renderReferenceSection(containerEl: HTMLElement, orderIndex: number): void {
    const sectionEl = containerEl.createDiv('section-config');

    // Section header with reorder controls
    const headerEl = sectionEl.createDiv('section-header');

    const titleEl = headerEl.createEl('h4', { text: 'Reference Note Section' });

    // Reorder buttons container
    const reorderContainer = headerEl.createDiv('section-reorder-buttons');

    // Up arrow
    const upBtn = reorderContainer.createEl('button', {
      text: '↑',
      cls: 'clickable-icon'
    });
    upBtn.disabled = orderIndex === 0;
    upBtn.onclick = (e) => {
      e.preventDefault();
      this.moveSectionUp(orderIndex);
    };

    // Down arrow
    const downBtn = reorderContainer.createEl('button', {
      text: '↓',
      cls: 'clickable-icon'
    });
    downBtn.disabled = orderIndex === (this.config.sectionOrder?.length ?? 1) - 1;
    downBtn.onclick = (e) => {
      e.preventDefault();
      this.moveSectionDown(orderIndex);
    };

    // Description
    const descEl = sectionEl.createDiv('section-description');
    descEl.setText('Displays the current file with a pin button. This section is always visible and cannot be hidden.');
  }

  /**
   * Moves a section up in the order.
   */
  private moveSectionUp(index: number): void {
    if (!this.config.sectionOrder || index === 0) return;

    // Swap with previous item
    const temp = this.config.sectionOrder[index];
    this.config.sectionOrder[index] = this.config.sectionOrder[index - 1];
    this.config.sectionOrder[index - 1] = temp;

    // Notify parent and refresh
    this.onChange(this.config);
    this.refresh();
  }

  /**
   * Moves a section down in the order.
   */
  private moveSectionDown(index: number): void {
    if (!this.config.sectionOrder || index === this.config.sectionOrder.length - 1) return;

    // Swap with next item
    const temp = this.config.sectionOrder[index];
    this.config.sectionOrder[index] = this.config.sectionOrder[index + 1];
    this.config.sectionOrder[index + 1] = temp;

    // Notify parent and refresh
    this.onChange(this.config);
    this.refresh();
  }

  /**
   * Refreshes the form by re-rendering it.
   */
  private refresh(): void {
    if (!this.formEl) return;

    // Store current collapsed state
    const wasCollapsed = this.collapsed;

    // Clear and re-render
    this.formEl.remove();
    this.collapsed = wasCollapsed;
    this.render();
  }

  /**
   * Destroys the form and cleans up.
   */
  destroy(): void {
    if (this.formEl) {
      this.formEl.remove();
      this.formEl = null;
    }
  }
}

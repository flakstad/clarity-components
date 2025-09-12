// TaskItem Web Component
// Provides a reusable task item that can be used standalone or within an outline

// Helper class for creating and managing task item buttons
class TaskItemButtons {
  constructor(taskItemElement) {
    this.taskItem = taskItemElement;
    this.li = taskItemElement.querySelector('li') || taskItemElement;
    this.features = taskItemElement.features || {};
  }

  // Create the buttons container with all buttons
  createButtonsContainer() {
    // Don't add buttons if they already exist
    if (this.li.querySelector(".outline-hover-buttons")) return null;

    const buttonsContainer = document.createElement("div");
    buttonsContainer.className = "outline-hover-buttons";

    // Create all buttons based on enabled features
    this.createPriorityButton(buttonsContainer);
    this.createBlockedButton(buttonsContainer);
    this.createDueButton(buttonsContainer);
    this.createScheduleButton(buttonsContainer);
    this.createAssignButton(buttonsContainer);
    this.createTagsButton(buttonsContainer);
    this.createCommentsButton(buttonsContainer);
    this.createWorklogButton(buttonsContainer);
    this.createArchiveButton(buttonsContainer);
    this.createEditButton(buttonsContainer); // Always enabled
    this.createOpenButton(buttonsContainer); // Always enabled

    // Reorder buttons according to desired order
    this.reorderButtons(buttonsContainer);

    return buttonsContainer;
  }

  createPriorityButton(container) {
    if (!this.features.priority) return;

    const priorityBtn = document.createElement("button");
    priorityBtn.className = "hover-button priority-button";
    priorityBtn.setAttribute("data-type", "priority");
    priorityBtn.tabIndex = -1;
    priorityBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!this.taskItem.isEditable()) {
        this.taskItem.showPermissionDeniedFeedback();
        return;
      }
      this.taskItem.togglePriority();
    });
    container.appendChild(priorityBtn);
  }

  createBlockedButton(container) {
    if (!this.features.blocked) return;

    const blockedBtn = document.createElement("button");
    blockedBtn.className = "hover-button blocked-button";
    blockedBtn.setAttribute("data-type", "blocked");
    blockedBtn.tabIndex = -1;
    blockedBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!this.taskItem.isEditable()) {
        this.taskItem.showPermissionDeniedFeedback();
        return;
      }
      this.taskItem.toggleBlocked();
    });
    container.appendChild(blockedBtn);
  }

  createDueButton(container) {
    if (!this.features.due) return;

    const dueBtn = document.createElement("button");
    dueBtn.className = "hover-button due-button";
    dueBtn.setAttribute("data-type", "due");
    dueBtn.tabIndex = -1;
    dueBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!this.taskItem.isEditable()) {
        this.taskItem.showPermissionDeniedFeedback();
        return;
      }
      this.taskItem.showDuePopup(dueBtn);
    });
    container.appendChild(dueBtn);
  }

  createScheduleButton(container) {
    if (!this.features.schedule) return;

    const scheduleBtn = document.createElement("button");
    scheduleBtn.className = "hover-button schedule-button";
    scheduleBtn.setAttribute("data-type", "schedule");
    scheduleBtn.tabIndex = -1;
    scheduleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!this.taskItem.isEditable()) {
        this.taskItem.showPermissionDeniedFeedback();
        return;
      }
      this.taskItem.showSchedulePopup(scheduleBtn);
    });
    container.appendChild(scheduleBtn);
  }

  createAssignButton(container) {
    if (!this.features.assign) return;

    const assignBtn = document.createElement("button");
    assignBtn.className = "hover-button assign-button";
    assignBtn.setAttribute("data-type", "assign");
    assignBtn.tabIndex = -1;
    assignBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!this.taskItem.isEditable()) {
        this.taskItem.showPermissionDeniedFeedback();
        return;
      }
      this.taskItem.showAssignPopup(assignBtn);
    });
    container.appendChild(assignBtn);
  }

  createTagsButton(container) {
    if (!this.features.tags) return;

    const tagsBtn = document.createElement("button");
    tagsBtn.className = "hover-button tags-button";
    tagsBtn.setAttribute("data-type", "tags");
    tagsBtn.tabIndex = -1;
    tagsBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!this.taskItem.isEditable()) {
        this.taskItem.showPermissionDeniedFeedback();
        return;
      }
      this.taskItem.showTagsPopup(tagsBtn);
    });
    container.appendChild(tagsBtn);
  }

  createCommentsButton(container) {
    if (!this.features.comments) return;

    const commentsBtn = document.createElement("button");
    commentsBtn.className = "hover-button comments-button";
    commentsBtn.setAttribute("data-type", "comments");
    commentsBtn.tabIndex = -1;
    commentsBtn.innerHTML = "<u>c</u>omment";
    commentsBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.taskItem.showCommentsPopup(commentsBtn);
    });
    container.appendChild(commentsBtn);
  }

  createWorklogButton(container) {
    if (!this.features.worklog) return;

    const worklogBtn = document.createElement("button");
    worklogBtn.className = "hover-button worklog-button";
    worklogBtn.setAttribute("data-type", "worklog");
    worklogBtn.tabIndex = -1;
    worklogBtn.innerHTML = "<u>w</u>orklog";
    worklogBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.taskItem.showWorklogPopup(worklogBtn);
    });
    container.appendChild(worklogBtn);
  }

  createArchiveButton(container) {
    if (!this.features.archive) return;

    const archiveBtn = document.createElement("button");
    archiveBtn.className = "hover-button archive-button";
    archiveBtn.setAttribute("data-type", "archive");
    archiveBtn.tabIndex = -1;
    archiveBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!this.taskItem.isEditable()) {
        this.taskItem.showPermissionDeniedFeedback();
        return;
      }
      this.taskItem.showArchivePopup(archiveBtn);
    });
    container.appendChild(archiveBtn);
  }

  createEditButton(container) {
    const editBtn = document.createElement("button");
    editBtn.className = "hover-button edit-button";
    editBtn.setAttribute("data-type", "edit");
    editBtn.textContent = "edit";
    editBtn.tabIndex = -1;
    editBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!this.taskItem.isEditable()) {
        this.taskItem.showPermissionDeniedFeedback();
        return;
      }
      this.taskItem.enterEditMode();
    });
    container.appendChild(editBtn);
  }

  createOpenButton(container) {
    const openBtn = document.createElement("button");
    openBtn.className = "hover-button open-button";
    openBtn.setAttribute("data-type", "open");
    openBtn.innerHTML = "<u>o</u>pen";
    openBtn.tabIndex = -1;
    openBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.taskItem.openItem();
    });
    container.appendChild(openBtn);
  }

  reorderButtons(container) {
    const desiredOrder = [
      '.open-button',
      '.edit-button',
      '.archive-button',
      '.schedule-button',
      '.due-button',
      '.priority-button',
      '.blocked-button',
      '.assign-button',
      '.tags-button',
      '.comments-button',
      '.worklog-button'
    ];
    
    desiredOrder.forEach(selector => {
      const btn = container.querySelector(selector);
      if (btn) {
        container.appendChild(btn);
      }
    });
  }
}

// TaskItem Web Component
class TaskItemElement extends HTMLElement {
  constructor() {
    super();
    this.outlineInstance = null;
    this.buttonManager = null;
    this.li = null;
    
    // Default features - can be overridden by attributes or outline instance
    this.features = {
      priority: true,
      blocked: true,
      due: true,
      schedule: true,
      assign: true,
      tags: true,
      comments: true,
      worklog: true,
      archive: true
    };
  }

  connectedCallback() {
    // Find the parent outline instance by traversing up the DOM
    this.findOutlineInstance();
    
    // Initialize the component
    this.initialize();
  }

  findOutlineInstance() {
    // Look for an outline instance in parent elements
    let parent = this.parentElement;
    while (parent) {
      // Check if parent has an outline instance
      if (parent._outlineInstance) {
        this.outlineInstance = parent._outlineInstance;
        break;
      }
      
      // Check if parent is an outline web component
      if (parent.tagName === 'CLARITY-OUTLINE' && parent.todoList) {
        this.outlineInstance = parent.todoList;
        break;
      }
      
      parent = parent.parentElement;
    }
    
    // If we found an outline, inherit its features
    if (this.outlineInstance && this.outlineInstance.options && this.outlineInstance.options.features) {
      this.features = { ...this.features, ...this.outlineInstance.options.features };
    }
  }

  initialize() {
    // Create or find the li element
    this.setupLiElement();
    
    // Set up basic properties
    this.li.tabIndex = 0;
    
    // Add hover buttons
    this.addButtons();
    
    // Set up status label click handler
    this.setupStatusLabelHandler();
    
    // Set up basic event handlers
    this.setupEventHandlers();
  }

  setupLiElement() {
    // Check if we already have an li child
    this.li = this.querySelector('li');
    
    if (!this.li) {
      // Create a new li element with basic structure
      this.li = document.createElement('li');
      this.li.dataset.id = this.getAttribute('data-id') || crypto.randomUUID();
      
      // Create the label span
      const labelSpan = document.createElement("span");
      labelSpan.className = "outline-label";
      labelSpan.textContent = this.getAttribute('data-status') || "TODO";

      // Create the text span
      const textSpan = document.createElement("span");
      textSpan.className = "outline-text";
      textSpan.textContent = this.getAttribute('data-text') || this.textContent || "New task";

      // Assemble the structure
      this.li.appendChild(labelSpan);
      this.li.appendChild(document.createTextNode(" "));
      this.li.appendChild(textSpan);
      
      // Clear any existing content and add the li
      this.innerHTML = '';
      this.appendChild(this.li);
    }
    
    // Ensure li has an ID
    if (!this.li.dataset.id) {
      this.li.dataset.id = this.getAttribute('data-id') || crypto.randomUUID();
    }
  }

  addButtons() {
    this.buttonManager = new TaskItemButtons(this);
    const buttonsContainer = this.buttonManager.createButtonsContainer();
    
    if (!buttonsContainer) return; // Buttons already exist
    
    // Insert buttons in the correct position
    this.insertButtonsContainer(buttonsContainer);
    
    // Set up hover behavior
    if (this.outlineInstance && this.outlineInstance.addHoverDelayHandlers) {
      this.outlineInstance.addHoverDelayHandlers(this.li, buttonsContainer);
    } else {
      // Fallback hover behavior if no outline instance
      this.setupBasicHoverBehavior(buttonsContainer);
    }
    
    // Update button states
    this.updateButtons();
  }

  insertButtonsContainer(buttonsContainer) {
    // Insert after the child-count if it exists, otherwise after the text span
    const childCount = this.li.querySelector(".child-count");
    if (childCount) {
      childCount.after(buttonsContainer);
    } else {
      const textSpan = this.li.querySelector(".outline-text");
      if (textSpan) {
        textSpan.after(buttonsContainer);
      } else {
        this.li.appendChild(buttonsContainer);
      }
    }
  }

  setupBasicHoverBehavior(buttonsContainer) {
    // Simple hover behavior when not in an outline
    this.li.addEventListener('mouseenter', () => {
      buttonsContainer.style.display = 'inline-flex';
    });

    this.li.addEventListener('mouseleave', () => {
      // Keep buttons visible if they have data
      const buttonsWithData = buttonsContainer.querySelectorAll('.hover-button.has-data');
      if (buttonsWithData.length === 0) {
        buttonsContainer.style.display = 'none';
      }
    });
  }

  setupStatusLabelHandler() {
    const statusLabel = this.li.querySelector(".outline-label");
    if (statusLabel && !statusLabel.dataset.handlerAdded) {
      statusLabel.style.cursor = "pointer";
      statusLabel.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!this.isEditable()) {
          this.showPermissionDeniedFeedback();
          return;
        }
        this.showStatusPopup(statusLabel);
      });
      statusLabel.dataset.handlerAdded = 'true';
    }
  }

  setupEventHandlers() {
    // Basic click handler for the task item
    this.li.addEventListener('click', (e) => {
      // Don't handle clicks on buttons or inputs
      if (e.target.tagName === 'BUTTON' || e.target.classList.contains('outline-edit-input')) {
        return;
      }

      // Check for Ctrl/Cmd + click to open item
      if (e.ctrlKey || e.metaKey) {
        this.li.focus();
        this.openItem();
        return;
      }

      // Single click: just focus/select the item
      this.li.focus();
      
      // Emit select event
      this.dispatchEvent(new CustomEvent('task-select', {
        detail: {
          id: this.id,
          text: this.text,
          element: this
        },
        bubbles: true
      }));
    });

    // Add double-click for edit mode
    this.li.addEventListener('dblclick', (e) => {
      // Don't handle clicks on buttons or inputs
      if (e.target.tagName === 'BUTTON' || e.target.classList.contains('outline-edit-input')) {
        return;
      }

      // Double click: enter edit mode
      this.enterEditMode();
    });

  }

  // Delegation methods - delegate to outline instance if available, otherwise provide basic functionality
  
  isEditable() {
    if (this.outlineInstance && this.outlineInstance.isItemEditable) {
      return this.outlineInstance.isItemEditable(this.li);
    }
    return this.li.dataset.editable !== 'false';
  }

  showPermissionDeniedFeedback() {
    if (this.outlineInstance && this.outlineInstance.showPermissionDeniedFeedback) {
      return this.outlineInstance.showPermissionDeniedFeedback(this.li);
    }
    
    // Basic permission denied feedback
    this.li.classList.add('permission-denied');
    setTimeout(() => {
      this.li.classList.remove('permission-denied');
    }, 1000);
  }

  enterEditMode() {
    if (this.outlineInstance && this.outlineInstance.enterEditMode) {
      return this.outlineInstance.enterEditMode(this.li);
    }
    
    // Basic edit mode implementation
    console.warn('enterEditMode called but no outline instance available for delegation');
  }

  togglePriority() {
    if (this.outlineInstance && this.outlineInstance.togglePriority) {
      return this.outlineInstance.togglePriority(this.li);
    }
    
    // Basic priority toggle
    this.li.classList.toggle('priority');
    this.updateButtons();
  }

  toggleBlocked() {
    if (this.outlineInstance && this.outlineInstance.toggleBlocked) {
      return this.outlineInstance.toggleBlocked(this.li);
    }
    
    // Basic blocked toggle
    this.li.classList.toggle('blocked');
    this.updateButtons();
  }

  showStatusPopup(statusLabel) {
    if (this.outlineInstance && this.outlineInstance.showStatusPopup) {
      return this.outlineInstance.showStatusPopup(this.li, statusLabel);
    }
    
    console.warn('showStatusPopup called but no outline instance available for delegation');
  }

  showDuePopup(button) {
    if (this.outlineInstance && this.outlineInstance.showDuePopup) {
      return this.outlineInstance.showDuePopup(this.li, button);
    }
    
    console.warn('showDuePopup called but no outline instance available for delegation');
  }

  showSchedulePopup(button) {
    if (this.outlineInstance && this.outlineInstance.showSchedulePopup) {
      return this.outlineInstance.showSchedulePopup(this.li, button);
    }
    
    console.warn('showSchedulePopup called but no outline instance available for delegation');
  }

  showAssignPopup(button) {
    if (this.outlineInstance && this.outlineInstance.showAssignPopup) {
      return this.outlineInstance.showAssignPopup(this.li, button);
    }
    
    console.warn('showAssignPopup called but no outline instance available for delegation');
  }

  showTagsPopup(button) {
    if (this.outlineInstance && this.outlineInstance.showTagsPopup) {
      return this.outlineInstance.showTagsPopup(this.li, button);
    }
    
    console.warn('showTagsPopup called but no outline instance available for delegation');
  }

  showCommentsPopup(button) {
    if (this.outlineInstance && this.outlineInstance.showCommentsPopup) {
      return this.outlineInstance.showCommentsPopup(this.li, button);
    }
    
    console.warn('showCommentsPopup called but no outline instance available for delegation');
  }

  showWorklogPopup(button) {
    if (this.outlineInstance && this.outlineInstance.showWorklogPopup) {
      return this.outlineInstance.showWorklogPopup(this.li, button);
    }
    
    console.warn('showWorklogPopup called but no outline instance available for delegation');
  }

  showArchivePopup(button) {
    if (this.outlineInstance && this.outlineInstance.showArchivePopup) {
      return this.outlineInstance.showArchivePopup(this.li, button);
    }
    
    console.warn('showArchivePopup called but no outline instance available for delegation');
  }

  openItem() {
    if (this.outlineInstance && this.outlineInstance.openItem) {
      return this.outlineInstance.openItem(this.li);
    }
    
    // Basic open implementation
    this.dispatchEvent(new CustomEvent('task-open', {
      detail: {
        id: this.id,
        text: this.text,
        element: this
      },
      bubbles: true
    }));
  }

  updateButtons() {
    if (this.outlineInstance && this.outlineInstance.updateHoverButtons) {
      return this.outlineInstance.updateHoverButtons(this.li);
    }
    
    // Basic button update - just ensure visibility is correct
    if (this.outlineInstance && this.outlineInstance.updateHoverButtonsVisibility) {
      return this.outlineInstance.updateHoverButtonsVisibility(this.li);
    }
  }

  // Getters for common properties
  get id() {
    return this.li ? this.li.dataset.id : this.getAttribute('data-id');
  }

  get text() {
    const textSpan = this.li ? this.li.querySelector(".outline-text") : null;
    return textSpan ? textSpan.textContent : this.getAttribute('data-text') || '';
  }

  get status() {
    const labelSpan = this.li ? this.li.querySelector(".outline-label") : null;
    return labelSpan ? labelSpan.textContent : this.getAttribute('data-status') || 'TODO';
  }

  // Setters for common properties
  set text(value) {
    const textSpan = this.li ? this.li.querySelector(".outline-text") : null;
    if (textSpan) {
      textSpan.textContent = value;
    }
    this.setAttribute('data-text', value);
  }

  set status(value) {
    const labelSpan = this.li ? this.li.querySelector(".outline-label") : null;
    if (labelSpan) {
      labelSpan.textContent = value;
    }
    this.setAttribute('data-status', value);
  }

  // Public API methods
  focus() {
    if (this.li) {
      this.li.focus();
    }
  }

  // Static method to register the web component
  static define(tagName = 'task-item') {
    if (!customElements.get(tagName)) {
      customElements.define(tagName, TaskItemElement);
    }
  }
}

// Auto-register the component
TaskItemElement.define();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TaskItemElement, TaskItemButtons };
}

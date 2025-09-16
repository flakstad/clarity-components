class Outline {
  constructor(el, options = {}) {
    this.el = el;
    // Set up default features
    const defaultFeatures = {
      priority: true,
      blocked: true,
      due: true,
      schedule: true,
      assign: true,
      tags: true,
      comments: true,
      worklog: true,
      archive: true,
      addButton: true,
      navigation: true,
      reorder: true,
      dragAndDrop: true
    };

    // Merge user features with defaults
    const features = { ...defaultFeatures, ...options.features };

    this.options = {
      assignees: options.assignees || [],
      tags: options.tags || [],
      currentUser: options.currentUser || 'current-user', // Default current user
      statusLabels: options.statusLabels || [
        { label: 'TODO', isEndState: false },
        { label: 'DONE', isEndState: true }
      ],
      features: features,
      ...options,
      // Ensure features don't get overridden by ...options
      features: features
    };
    this.init();
  }

  init() {
    // Initialize all existing li elements as TaskItems
    this.el.querySelectorAll("li").forEach(li => {
      const taskItem = TaskItem.fromElement(li, this);
      // TaskItem initialization handles tabIndex, buttons, and status label click handler
    });
    
    this.bindEvents();
    this.initNewTodoButton();

    // Initialize child counts and button visibility for existing items
    this.el.querySelectorAll("li").forEach(li => {
      this.updateChildCount(li);
      this.updateHoverButtonsVisibility(li);
    });

    // Initialize drag-and-drop if enabled
    if (this.options.features.dragAndDrop) {
      this.initDragAndDrop();
    }
  }

  getCurrentUser() {
    return this.options.currentUser;
  }

  isItemEditable(li) {
    return li.dataset.editable !== 'false';
  }

  showPermissionDeniedFeedback(li, action = 'edit') {
    // Add a subtle visual feedback that the action is not permitted
    li.classList.add('permission-denied');
    
    // Remove the class after a short delay
    setTimeout(() => {
      li.classList.remove('permission-denied');
    }, 1000);
    
    // Emit a permission denied event for external handling
    this.emit('outline:permission-denied', {
      id: li.dataset.id,
      action: action
    });
  }

  hasIncompleteChildren(li) {
    // Check if this todo has children that are not completed
    const sublist = li.querySelector("ul");
    if (!sublist || sublist.children.length === 0) {
      return false; // No children, so no incomplete children
    }

    // Get direct children only (not nested descendants)
    const directChildren = Array.from(sublist.children).filter(c => c.tagName === "LI");
    // Only count items with labels as "completable" - exclude header-like (no-label) children
    const completableChildren = directChildren.filter(c => !c.classList.contains("no-label"));
    
    if (completableChildren.length === 0) {
      return false; // No completable children
    }

    // Check if any completable children are not completed
    const incompleteChildren = completableChildren.filter(c => !c.classList.contains("completed"));
    return incompleteChildren.length > 0;
  }

  canCompleteParent(li, targetStatus) {
    // Only apply this restriction when trying to set to a completed state
    if (!targetStatus.startsWith('status-')) {
      return true; // Allow non-status changes (like 'none')
    }

    const statusIndex = parseInt(targetStatus.split('-')[1]);
    const statusLabel = this.options.statusLabels[statusIndex];
    
    if (!statusLabel || !statusLabel.isEndState) {
      return true; // Not trying to set to completed state
    }

    // Check if this todo has incomplete children
    return !this.hasIncompleteChildren(li);
  }

  initNewTodoButton() {
    // Skip if addButton feature is disabled
    if (!this.options.features.addButton) {
      return;
    }

    // Check if button already exists
    if (this.addButton) {
      return; // Button already exists, don't create another one
    }

    // Create the add button
    this.addButton = document.createElement("button");
    this.addButton.className = "hover-button outline-add-button";
    this.addButton.textContent = "+ Add";
    this.addButton.addEventListener("click", () => {
      this.createNewTodo();
    });

    // Insert the button after the list
    this.el.parentNode.insertBefore(this.addButton, this.el.nextSibling);
  }

  createNewTodo() {
    // Create a new TaskItem and enter edit mode immediately
    const taskItem = TaskItem.create(this, "New todo", "TODO");
    
    // Add to the list
    this.el.appendChild(taskItem.li);

    // Enter edit mode immediately
    taskItem.enterEditMode();

    // Emit add event
    this.emit("outline:add", {
      text: taskItem.text,
      id: taskItem.id,
      parentId: null
    });
  }

  bindEvents() {
    // Add global document event listener for Escape key to close popups
    document.addEventListener("keydown", e => {
      if (e.key === 'Escape') {
        const activePopup = this.el.querySelector('.outline-popup');
        if (activePopup) {
          this.closeAllPopups();
        }
      }
    });

    this.el.addEventListener("click", e => {
      const li = e.target.closest("li");
      if (!li) return;

      // Check if click is on a button (metadata buttons should handle their own clicks)
      if (e.target.tagName === "BUTTON") {
        return; // Let button handle its own click
      }

      // Check if click is on edit input (don't navigate when editing)
      if (e.target.classList.contains("outline-edit-input")) {
        return; // Let edit input handle its own clicks
      }

      // Check for Ctrl/Cmd + click to open item
      if (e.ctrlKey || e.metaKey) {
        li.focus();
        console.log("Todo item opened via Ctrl/Cmd+click", li.dataset.id);
        this.openItem(li);
        return;
      }

      // Single click: just focus/select the item (no navigation)
      li.focus();
      console.log("Todo item selected", li.dataset.id);

      this.emit("outline:select", {
        id: li.dataset.id,
        text: li.querySelector(".outline-text").textContent
      });
    });

    // Add double-click for edit mode
    this.el.addEventListener("dblclick", e => {
      const li = e.target.closest("li");
      if (!li) return;

      // Check if click is on a button (metadata buttons should handle their own clicks)
      if (e.target.tagName === "BUTTON") {
        return; // Let button handle its own click
      }

      // Check if click is on edit input (don't enter edit mode when already editing)
      if (e.target.classList.contains("outline-edit-input")) {
        return; // Let edit input handle its own clicks
      }

      // Double click: enter edit mode
      console.log("Todo item double-clicked - entering edit mode", li.dataset.id);
      if(!this.isItemEditable(li)) {
        this.showPermissionDeniedFeedback(li);
        return;
      }
      this.enterEditMode(li);
    });

    this.el.addEventListener("keydown", e => {
      const li = e.target.closest("li");

      // If there's a popup open, handle limited keyboard events
      const activePopup = this.el.querySelector('.outline-popup');
      if (activePopup) {
        // Only handle events if they come from outside the popup
        if (!activePopup.contains(e.target)) {
          // Handle Escape to close popup from anywhere
          if (e.key === 'Escape') {
            this.closeAllPopups();
            return;
          }
          // Allow opening new popups (this will close the current one)
          if (e.key === 'd' || e.key === 's' || e.key === 'c' || e.key === 'w' || e.key === 'a' || e.key === 't') {
            // Let the event continue to be processed
          } else {
            return;
          }
        } else {
          // If event is from inside popup, let it bubble normally
          return;
        }
      }

      if(!li) return;

      // If any todo is in edit mode, ignore all shortcuts except for the edit input itself
      if (this.el.querySelector("li.editing")) {
        // Only allow edit input to handle its own events
        if (!e.target.classList.contains("outline-edit-input")) {
          return;
        }
        // If this is the edit input, let it handle its own events (Enter, Escape, etc.)
        return;
      }

      const siblings = this.getSiblings(li);
      const idx = siblings.indexOf(li);

      // Enter edit mode
      if(e.key==="e" && !e.altKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if(!this.isItemEditable(li)) {
          this.showPermissionDeniedFeedback(li);
          return;
        }
        this.enterEditMode(li);
        return;
      }

      // Handle Alt key combinations FIRST (before single-key shortcuts)
      if(e.altKey && !e.ctrlKey && !e.metaKey && this.options.features.reorder) {
        console.log('Alt key detected:', e.code, 'idx:', idx, 'siblings:', siblings.length, 'e.altKey:', e.altKey, 'e.key:', e.key);

        // Move item down (Alt+N, Alt+J, Alt+ArrowDown)
        const moveDownKeys = ['KeyN', 'KeyJ', 'ArrowDown'];
        if(moveDownKeys.includes(e.code)){
          if(!this.isItemEditable(li)) {
            e.preventDefault();
            this.showPermissionDeniedFeedback(li);
            return;
          }
          if(idx<siblings.length-1){
            console.log(`Alt+${e.code}: Moving item down, idx:`, idx, 'siblings:', siblings.length);
            e.preventDefault();
            if(e.code === 'ArrowDown') {
              // Arrow key logic
              li.parentNode.insertBefore(li, siblings[idx+1].nextSibling);
            } else {
              // Emacs/Vi key logic
              const nextSibling = siblings[idx+1];
              if (nextSibling.nextSibling) {
                li.parentNode.insertBefore(li, nextSibling.nextSibling);
              } else {
                li.parentNode.appendChild(li);
              }
            }
            // Recalculate siblings after the move to ensure proper state
            const newSiblings = this.getSiblings(li);
            const newIdx = newSiblings.indexOf(li);
            li.focus();
            this.emit("outline:move",{id:li.dataset.id,from:idx,to:newIdx});
            return;
          } else {
            console.log(`Alt+${e.code}: Cannot move down - item is last in level, idx:`, idx, 'siblings:', siblings.length);
          }
        }

        // Move item up (Alt+P, Alt+K, Alt+ArrowUp)
        const moveUpKeys = ['KeyP', 'KeyK', 'ArrowUp'];
        if(moveUpKeys.includes(e.code)){
          if(!this.isItemEditable(li)) {
            e.preventDefault();
            this.showPermissionDeniedFeedback(li);
            return;
          }
          if(idx>0){
            console.log(`Alt+${e.code}: Moving item up, idx:`, idx, 'siblings:', siblings.length);
            e.preventDefault();
            li.parentNode.insertBefore(li, siblings[idx-1]);
            // Recalculate siblings after the move to ensure proper state
            const newSiblings = this.getSiblings(li);
            const newIdx = newSiblings.indexOf(li);
            li.focus();
            this.emit("outline:move",{id:li.dataset.id,from:idx,to:newIdx});
            return;
          } else {
            console.log(`Alt+${e.code}: Cannot move up - item is first in level, idx:`, idx, 'siblings:', siblings.length);
          }
        }

        // Indent item (Alt+F, Alt+L, Alt+ArrowRight)
        const indentKeys = ['KeyF', 'KeyL', 'ArrowRight'];
        if(indentKeys.includes(e.code)){
          if(!this.isItemEditable(li)) {
            e.preventDefault();
            this.showPermissionDeniedFeedback(li);
            return;
          }
          console.log(`Alt+${e.code}: Indenting item`);
          e.preventDefault();
          this.indentItem(li);
          return;
        }

        // Outdent item (Alt+B, Alt+H, Alt+ArrowLeft)
        const outdentKeys = ['KeyB', 'KeyH', 'ArrowLeft'];
        if(outdentKeys.includes(e.code)){
          if(!this.isItemEditable(li)) {
            e.preventDefault();
            this.showPermissionDeniedFeedback(li);
            return;
          }
          console.log(`Alt+${e.code}: Outdenting item`);
          e.preventDefault();
          this.outdentItem(li);
          return;
        }


      }

      // Add/cycle tags with 't' key
      if(e.key==="t" && !e.altKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if(!this.isItemEditable(li)) {
          this.showPermissionDeniedFeedback(li);
          return;
        }
        const tagsBtn = li.querySelector(".tags-button");
        if (tagsBtn) {
          this.showTagsPopup(li, tagsBtn);
        }
        return;
      }

      // Toggle priority with 'p' key (only if enabled)
      if(e.key==="p" && !e.altKey && !e.ctrlKey && !e.metaKey && this.options.features.priority) {
        e.preventDefault();
        if(!this.isItemEditable(li)) {
          this.showPermissionDeniedFeedback(li);
          return;
        }
        this.togglePriority(li);
        return;
      }

      // Toggle blocked with 'b' key (only if enabled)
      if(e.key==="b" && !e.altKey && !e.ctrlKey && !e.metaKey && this.options.features.blocked) {
        e.preventDefault();
        if(!this.isItemEditable(li)) {
          this.showPermissionDeniedFeedback(li);
          return;
        }
        this.toggleBlocked(li);
        return;
      }

      // Set due date with 'd' key (only if enabled)
      if(e.key==="d" && !e.altKey && !e.ctrlKey && !e.metaKey && this.options.features.due) {
        e.preventDefault();
        if(!this.isItemEditable(li)) {
          this.showPermissionDeniedFeedback(li);
          return;
        }
        const dueBtn = li.querySelector(".due-button");
        if (dueBtn) {
          this.showDuePopup(li, dueBtn);
        }
        return;
      }

      // Set schedule date with 's' key (only if enabled)
      if(e.key==="s" && !e.altKey && !e.ctrlKey && !e.metaKey && this.options.features.schedule) {
        e.preventDefault();
        if(!this.isItemEditable(li)) {
          this.showPermissionDeniedFeedback(li);
          return;
        }
        const scheduleBtn = li.querySelector(".schedule-button");
        if (scheduleBtn) {
          this.showSchedulePopup(li, scheduleBtn);
        }
        return;
      }

      // Add comment with 'c' key (only if enabled)
      if(e.key==="c" && !e.altKey && !e.ctrlKey && !e.metaKey && this.options.features.comments) {
        e.preventDefault();
        const commentsBtn = li.querySelector(".comments-button");
        if (commentsBtn) {
          this.showCommentsPopup(li, commentsBtn);
        }
        return;
      }

      // Add worklog entry with 'w' key (only if enabled)
      if(e.key==="w" && !e.altKey && !e.ctrlKey && !e.metaKey && this.options.features.worklog) {
        e.preventDefault();
        const worklogBtn = li.querySelector(".worklog-button");
        if (worklogBtn) {
          this.showWorklogPopup(li, worklogBtn);
        }
        return;
      }

      // Archive item with 'r' key or Del key (only if enabled)
      if((e.key==="r" || e.key==="Delete") && !e.altKey && !e.ctrlKey && !e.metaKey && this.options.features.archive) {
        e.preventDefault();
        if(!this.isItemEditable(li)) {
          this.showPermissionDeniedFeedback(li);
          return;
        }
        const archiveBtn = li.querySelector(".archive-button");
        if (archiveBtn) {
          this.showArchivePopup(li, archiveBtn);
        }
        return;
      }

      // Status with SPACE key (always enabled)
      if(e.key===" " && !e.altKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if(!this.isItemEditable(li)) {
          this.showPermissionDeniedFeedback(li);
          return;
        }
        const statusLabel = li.querySelector(".outline-label");
        if (statusLabel) {
          this.showStatusPopup(li, statusLabel);
        }
        return;
      }

      // Assign with 'a' key (only if enabled)
      if(e.key==="a" && !e.altKey && !e.ctrlKey && !e.metaKey && this.options.features.assign) {
        e.preventDefault();
        if(!this.isItemEditable(li)) {
          this.showPermissionDeniedFeedback(li);
          return;
        }
        const assignBtn = li.querySelector(".assign-button");
        if (assignBtn) {
          this.showAssignPopup(li, assignBtn);
        }
        return;
      }

      // Open item with 'o' key
      if(e.key==="o" && !e.altKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        this.openItem(li);
        return;
      }

      // Open item with Enter
      if(e.key==="Enter" && !e.altKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        this.openItem(li);
        return;
      }

      // Create new sibling todo with Alt+Enter (only if enabled)
      if(e.key==="Enter" && e.altKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if (!this.options.features.addButton) {
          this.showPermissionDeniedFeedback(li, 'add-new-item');
          return;
        }
        this.addSiblingTodo(li);
        return;
      }

      // Cycle collapsed/expanded with Alt+T (toggle hierarchy)
      if(e.code==="KeyT" && e.altKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        this.cycleCollapsedState(li);
        return;
      }

      // Cycle states with Shift + left/right arrows
      if(e.key==="ArrowLeft" && e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        this.cycleTodoStateBackward(li);
        return;
      }

      if(e.key==="ArrowRight" && e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        this.cycleTodoStateForward(li);
        return;
      }

      // Toggle priority with Shift + up/down arrows (only if enabled)
      if(e.key==="ArrowUp" && e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey && this.options.features.priority) {
        e.preventDefault();
        this.togglePriority(li);
        return;
      }

      if(e.key==="ArrowDown" && e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey && this.options.features.priority) {
        e.preventDefault();
        this.togglePriority(li);
        return;
      }

      // Focus Navigation - Move Down (ArrowDown, Ctrl+N, J)
      if(this.options.features.navigation) {
        const moveDownKeys = ['ArrowDown', 'n', 'j'];
        if(moveDownKeys.includes(e.key) &&
         ((e.key === 'ArrowDown' && !e.altKey && !e.ctrlKey && !e.metaKey) ||
          (e.key === 'n' && e.ctrlKey && !e.altKey && !e.metaKey) ||
          (e.key === 'j' && !e.altKey && !e.ctrlKey && !e.metaKey))) {
        console.log(`Focus: Moving down with ${e.key} (${e.ctrlKey ? 'Ctrl+' : ''}${e.key})`);
        e.preventDefault();
        if(idx < siblings.length - 1) {
          siblings[idx+1].focus();
        } else {
          // last child, move to next available item by traversing up the hierarchy
          this.navigateToNextItem(li);
        }
        return;
      }

      // Focus Navigation - Move Up (ArrowUp, Ctrl+P, K)
      const moveUpKeys = ['ArrowUp', 'p', 'k'];
      if(moveUpKeys.includes(e.key) &&
         ((e.key === 'ArrowUp' && !e.altKey && !e.ctrlKey && !e.metaKey) ||
          (e.key === 'p' && e.ctrlKey && !e.altKey && !e.metaKey) ||
          (e.key === 'k' && !e.altKey && !e.ctrlKey && !e.metaKey))) {
        console.log(`Focus: Moving up with ${e.key} (${e.ctrlKey ? 'Ctrl+' : ''}${e.key})`);
        e.preventDefault();
        if(idx > 0) {
          siblings[idx-1].focus();
        } else {
          // first child, move focus to parent li if exists
          const parentLi = li.parentNode.closest("li");
          if(parentLi) parentLi.focus();
        }
        return;
      }

      // Focus Navigation - Move Right/Forward (ArrowRight, Ctrl+F, L)
      const moveRightKeys = ['ArrowRight', 'f', 'l'];
      if(moveRightKeys.includes(e.key) &&
         ((e.key === 'ArrowRight' && !e.altKey && !e.ctrlKey && !e.metaKey) ||
          (e.key === 'f' && e.ctrlKey && !e.altKey && !e.metaKey) ||
          (e.key === 'l' && !e.altKey && !e.ctrlKey && !e.metaKey))) {
        console.log(`Focus: Moving right/forward with ${e.key} (${e.ctrlKey ? 'Ctrl+' : ''}${e.key})`);
        e.preventDefault();
        const sublist = li.querySelector("ul");
        if (sublist && sublist.children.length > 0) {
          // If collapsed, expand first-level children only
          if (li.classList.contains("collapsed")) {
            this.expandItem(li); // only expands direct children
          }
          const firstChild = sublist.querySelector("li");
          if (firstChild) firstChild.focus();
        }
        return;
      }

      // Focus Navigation - Move Left/Backward (ArrowLeft, Ctrl+B, H)
      const moveLeftKeys = ['ArrowLeft', 'b', 'h'];
      if(moveLeftKeys.includes(e.key) &&
         ((e.key === 'ArrowLeft' && !e.altKey && !e.ctrlKey && !e.metaKey) ||
          (e.key === 'b' && e.ctrlKey && !e.altKey && !e.metaKey) ||
          (e.key === 'h' && !e.altKey && !e.ctrlKey && !e.metaKey))) {
        console.log(`Focus: Moving left/backward with ${e.key} (${e.ctrlKey ? 'Ctrl+' : ''}${e.key})`);
        e.preventDefault();
        const parentLi = li.parentNode.closest("li");
        if (parentLi) {
          parentLi.focus();
        }
        return;
      }
      } // End navigation feature check




    });

    this.el.addEventListener("click", e=>{
      const li=e.target.closest("li.has-children");
      if(li && e.target === li.querySelector("::before")){ // pseudo-element won't trigger directly
        const sublist=li.querySelector("ul");
        if(sublist.style.display==="none") this.expandItem(li);
        else this.collapseItem(li);
      }
    });
  }

  getItems() { return Array.from(this.el.querySelectorAll("li")); }
  getSiblings(li){ return Array.from(li.parentNode.children).filter(c=>c.tagName==="LI"); }

  toggleItem(li) {
    const label = li.querySelector(".outline-label");
    if (!label) return;

    // Get current status index
    const currentText = label.textContent.trim();
    const currentIndex = this.options.statusLabels.findIndex(status => status.label === currentText);

    let nextState;

    if (li.classList.contains("completed")) {
      // Last status → no label
      nextState = "none";
      li.classList.remove("completed");
      li.classList.add("no-label");
      label.style.display = "none";
    } else if (li.classList.contains("no-label")) {
      // no label → first status
      nextState = `status-0`;
      li.classList.remove("no-label");
      label.style.display = "";
      label.textContent = this.options.statusLabels[0].label;
    } else if (currentIndex >= 0 && currentIndex < this.options.statusLabels.length - 1) {
      // current status → next status
      nextState = `status-${currentIndex + 1}`;
      label.textContent = this.options.statusLabels[currentIndex + 1].label;

      // Check if this should be treated as completed
      if (this.options.statusLabels[currentIndex + 1].isEndState) {
        li.classList.add("completed");
      } else {
        li.classList.remove("completed");
      }
    } else if (currentIndex >= 0 && this.options.statusLabels[currentIndex].isEndState) {
      // Check if there are more end states after this one
      const remainingEndStates = this.options.statusLabels
        .slice(currentIndex + 1)
        .filter(status => status.isEndState);

      if (remainingEndStates.length > 0) {
        // Go to next end state
        const nextEndStateIndex = this.options.statusLabels.findIndex((status, index) =>
          index > currentIndex && status.isEndState
        );
        nextState = `status-${nextEndStateIndex}`;
        label.textContent = this.options.statusLabels[nextEndStateIndex].label;
        li.classList.add("completed");
      } else {
        // No more end states, go to no-label
        nextState = "none";
        li.classList.remove("completed");
        li.classList.add("no-label");
        label.style.display = "none";
      }
    } else {
      // fallback: first status → second status
      nextState = `status-1`;
      label.textContent = this.options.statusLabels[1].label;
      li.classList.remove("completed");
    }

    this.emit("outline:toggle", {
      id: li.dataset.id,
      to: nextState,
      completed: li.classList.contains("completed"),
      hasLabel: !li.classList.contains("no-label")
    });

    let parentLi = li.parentNode.closest("li");
    while(parentLi) {
      this.updateChildCount(parentLi);
      parentLi = parentLi.parentNode.closest("li");
    }

    // Update hover buttons to reflect new state
    this.updateHoverButtons(li);
  }


  addItem(text, parentLi) {
    const li = document.createElement("li");
    li.tabIndex = 0;
    li.dataset.id = crypto.randomUUID();

    // Create label span
    const label = document.createElement("span");
    label.className = "outline-label";
    label.textContent = this.options.statusLabels[0].label;
    label.style.cursor = "pointer";
    label.addEventListener("click", (e) => {
      e.stopPropagation();
      this.showStatusPopup(li, label);
    });

    // Create text span
    const spanText = document.createElement("span");
    spanText.className = "outline-text";
    spanText.textContent = text;

    li.appendChild(label);
    li.appendChild(document.createTextNode(" "));
    li.appendChild(spanText);

    // Add hover buttons
    this.addHoverButtons(li);    

    if (parentLi) {
      let sublist = parentLi.querySelector("ul");
      if (!sublist) {
        sublist = document.createElement("ul");
        parentLi.appendChild(sublist);
        parentLi.classList.add("has-children");
        
        // Initialize sortable on new sublist if drag-and-drop is enabled
        if (this.options.features.dragAndDrop) {
          this.initSortableOnNewSublist(sublist);
        }
      }
      sublist.appendChild(li);
    } else {
      this.el.appendChild(li);
    }

    li.focus();
    this.emit("outline:add", { text, id: li.dataset.id });

    // Update child counts for all affected parents
    if (parentLi) {
      this.updateChildCount(parentLi);
      // Also update any grandparent counts
      let grandparentLi = parentLi.parentNode.closest("li");
      while (grandparentLi) {
        this.updateChildCount(grandparentLi);
        grandparentLi = grandparentLi.parentNode.closest("li");
      }
      
      // Ensure the direct parent counter is correct after grandparent updates
      // This fixes a bug where nested no-label parents don't get counters
      this.updateChildCount(parentLi);
    }
  }


  indentItem(li){
    const siblings=this.getSiblings(li); const idx=siblings.indexOf(li);
    if(idx===0) return;
    const prev=siblings[idx-1];

    // Store the old parent before moving the item
    const oldParentLi = li.parentNode.closest("li");

    let sublist=prev.querySelector("ul");
    if(!sublist){
      sublist=document.createElement("ul");
      prev.appendChild(sublist);
      prev.classList.add("has-children");
      
      // Initialize sortable on new sublist if drag-and-drop is enabled
      if (this.options.features.dragAndDrop) {
        this.initSortableOnNewSublist(sublist);
      }
    }
    sublist.appendChild(li); li.focus();
    this.emit("outline:indent",{id:li.dataset.id,parent:prev.dataset.id});

    // Update child counts for all affected parents
    this.updateChildCount(prev);

    // Update counts for any grandparents of the new parent
    let grandparentLi = prev.parentNode.closest("li");
    while (grandparentLi) {
      this.updateChildCount(grandparentLi);
      grandparentLi = grandparentLi.parentNode.closest("li");
    }

    // Update the old parent's child count (if it was a parent)
    if (oldParentLi && oldParentLi !== prev) {
      this.updateChildCount(oldParentLi);
      // Also update any grandparents of the old parent
      let oldGrandparentLi = oldParentLi.parentNode.closest("li");
      while (oldGrandparentLi) {
        this.updateChildCount(oldGrandparentLi);
        oldGrandparentLi = oldGrandparentLi.parentNode.closest("li");
      }
    }

    // Update counts for any parents of the moved item (if it had children)
    const movedItemChildren = li.querySelectorAll("li");
    if (movedItemChildren.length > 0) {
      // The moved item had children, so we need to update its count
      this.updateChildCount(li);
    }
    
    // FINAL FIX: Ensure the direct parent counter is correct after all other updates
    // This fixes a bug where nested no-label parents don't get counters during indenting
    this.updateChildCount(prev);
  }

  outdentItem(li){
    const parentUl=li.parentNode;
    if(parentUl===this.el) return;
    const parentLi=parentUl.closest("li"); const grandUl=parentLi.parentNode;
    grandUl.insertBefore(li,parentLi.nextSibling); li.focus();
    this.emit("outline:outdent",{id:li.dataset.id,newParent:grandUl.id||null});

    // Update child counts for all affected parents
    this.updateChildCount(parentLi);

    // Update counts for any grandparents of the old parent
    let grandparentLi = parentLi.parentNode.closest("li");
    while (grandparentLi) {
      this.updateChildCount(grandparentLi);
      grandparentLi = grandparentLi.parentNode.closest("li");
    }

    // Remove has-children class and empty ul if no more children
    const sublist = parentLi.querySelector("ul");
    if (sublist && sublist.children.length === 0) {
      parentLi.classList.remove("has-children");
      sublist.remove();
    }

    // Update counts for any new parents of the moved item
    const newParentLi = li.parentNode.closest("li");
    if (newParentLi) {
      this.updateChildCount(newParentLi);
      // Also update any grandparents of the new parent
      let newGrandparentLi = newParentLi.parentNode.closest("li");
      while (newGrandparentLi) {
        this.updateChildCount(newGrandparentLi);
        newGrandparentLi = newGrandparentLi.parentNode.closest("li");
      }
    }

    // Update counts for the moved item itself (if it had children)
    const movedItemChildren = li.querySelectorAll("li");
    if (movedItemChildren.length > 0) {
      this.updateChildCount(li);
    }
    
    // FINAL FIX: Ensure all affected parents have correct counters after outdenting
    // This fixes a bug where parents lose counters during outdenting operations
    this.updateChildCount(parentLi);
    if (newParentLi) {
      this.updateChildCount(newParentLi);
    }
  }

  collapseItem(li){
    const sublist=li.querySelector("ul");
    if(sublist){
        sublist.style.display="none";
        li.classList.add("collapsed");
    }
    this.emit("outline:collapse",{id:li.dataset.id});
  }

  expandItem(li){
    const sublist=li.querySelector("ul");
    if(sublist){
        sublist.style.display="block";
        li.classList.remove("collapsed");
    }
    this.emit("outline:expand",{id:li.dataset.id});
  }

  updateChildCount(li) {
    // Headers (no-label) can still display child counts; only children without labels are excluded from counts

    const sublist = li.querySelector("ul");
    let countSpan = li.querySelector(".child-count");

    if (!sublist || sublist.children.length === 0) {
        // Remove count if no children
        if (countSpan) countSpan.remove();
        // Remove has-children class if no children
        li.classList.remove("has-children");
        return;
    }

    // Count direct children only (not nested descendants)
    const directChildren = Array.from(sublist.children).filter(c => c.tagName === "LI");
    // Only count items with labels as "completable" - exclude header-like (no-label) children
    const completableChildren = directChildren.filter(c => !c.classList.contains("no-label"));
    const doneCount = completableChildren.filter(c => c.classList.contains("completed")).length;

    // Show count only if there are completable children
    if (completableChildren.length > 0) {
        // Create or reuse count span
        if (!countSpan) {
            countSpan = document.createElement("span");
            countSpan.className = "child-count";
        }
        
        // Always position the child-count correctly (whether new or existing)
        this.positionChildCount(li, countSpan);
        
        // Create progress bar instead of text
        this.createProgressBar(countSpan, doneCount, completableChildren.length);
        countSpan.style.display = "";
    } else {
        // Remove the count span entirely when no completable children
        if (countSpan) {
            countSpan.remove();
        }
    }
  }

  positionChildCount(li, countSpan) {
    const textSpan = li.querySelector(".outline-text");
    if (!textSpan) {
      li.appendChild(countSpan);
      return;
    }

    // Always insert directly after the text span
    textSpan.after(countSpan);
  }

  createProgressBar(container, doneCount, totalCount) {
    Outline.createProgressBar(container, doneCount, totalCount);
  }

  static createProgressBar(container, doneCount, totalCount) {
    // Clear existing content
    container.innerHTML = '';
    
    // Create progress bar container
    const progressContainer = document.createElement('div');
    progressContainer.className = 'progress-container';
    
    // Create progress bar background
    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    
    // Create progress fill
    const progressFill = document.createElement('div');
    progressFill.className = 'progress-fill';
    
    // Calculate progress percentage
    const progressPercentage = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;
    progressFill.style.width = `${progressPercentage}%`;
    
    // Create text overlay with numbers positioned on top of the bar
    const progressText = document.createElement('div');
    progressText.className = 'progress-text';
    progressText.textContent = `${doneCount}/${totalCount}`;
    
    // Position text based on progress with half-white/half-black effect
    if (progressPercentage >= 50) {
      // If half or more complete, show text on the completed portion (white for contrast)
      progressText.style.color = '#ffffff';
      progressText.style.textShadow = '0 0 2px rgba(0,0,0,0.3)';
    } else {
      // If less than half complete, show text on the uncompleted portion (darker for better contrast)
      progressText.style.color = 'var(--clarity-outline-text-primary)';
    }
    
    // Create half-white/half-black effect for text when around 50% complete
    if (progressPercentage >= 40 && progressPercentage <= 60) {
      // Create a gradient effect that splits the text
      const gradientStop = ((progressPercentage - 40) / 20) * 100; // 0-100% based on 40-60% progress
      progressText.style.background = `linear-gradient(90deg, 
        #ffffff 0%, 
        #ffffff ${gradientStop}%, 
        var(--clarity-outline-text-primary) ${gradientStop}%, 
        var(--clarity-outline-text-primary) 100%)`;
      progressText.style.webkitBackgroundClip = 'text';
      progressText.style.backgroundClip = 'text';
      progressText.style.webkitTextFillColor = 'transparent';
      progressText.style.textShadow = 'none';
    }
    
    // Assemble the progress bar with text positioned on top
    progressBar.appendChild(progressFill);
    progressBar.appendChild(progressText);
    progressContainer.appendChild(progressBar);
    container.appendChild(progressContainer);
  }



  enterEditMode(li) {
    // Don't enter edit mode if already editing
    if (li.classList.contains("editing")) return;

    const textSpan = li.querySelector(".outline-text");
    if (!textSpan) return;

    const currentText = textSpan.textContent;

    // Create input element
    const input = document.createElement("input");
    input.type = "text";
    input.className = "outline-edit-input";
    input.value = currentText;

    // Add editing class and insert input
    li.classList.add("editing");
    textSpan.after(input);

    // Hide child-count when entering edit mode
    const childCount = li.querySelector(".child-count");
    if (childCount) {
      childCount.style.display = "none";
    }

    // Hide hover buttons when entering edit mode
    const hoverButtons = li.querySelector(".outline-hover-buttons");
    if (hoverButtons) {
      hoverButtons.style.display = "none";
    }

    // Focus and select all text
    input.focus();
    input.select();

    // Handle input events
    const handleKeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (e.altKey) {
          // Alt+Enter: Save current edit and add new todo (only if enabled)
          this.saveEdit(li, input.value);
          if (!this.options.features.addButton) {
            this.showPermissionDeniedFeedback(li, 'add-new-item');
            return;
          }
          // Add new sibling todo after the current one and enter edit mode
          this.addSiblingTodo(li);
        } else {
          // Regular Enter: Just save
          this.saveEdit(li, input.value);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        this.exitEditMode(li);
      }
    };

    const handleBlur = () => {
      this.saveEdit(li, input.value);
    };

    input.addEventListener("keydown", handleKeydown);
    input.addEventListener("blur", handleBlur);

    // Store event handlers for cleanup
    input._handleKeydown = handleKeydown;
    input._handleBlur = handleBlur;

    this.emit("outline:edit:start", {
      id: li.dataset.id,
      originalText: currentText
    });
  }

  exitEditMode(li) {
    const input = li.querySelector(".outline-edit-input");
    if (!input) return;

    // Remove event listeners
    input.removeEventListener("keydown", input._handleKeydown);
    input.removeEventListener("blur", input._handleBlur);

    // Remove input and editing class
    input.remove();
    li.classList.remove("editing");

    // Show child-count when exiting edit mode
    const childCount = li.querySelector(".child-count");
    if (childCount) {
      childCount.style.display = "";
    }

    // Show hover buttons when exiting edit mode
    const hoverButtons = li.querySelector(".outline-hover-buttons");
    if (hoverButtons) {
      hoverButtons.style.display = "";
    }

    // Restore focus to li
    li.focus();

    this.emit("outline:edit:cancel", {
      id: li.dataset.id
    });
  }

  saveEdit(li, newText) {
    const input = li.querySelector(".outline-edit-input");
    if (!input) return;

    const textSpan = li.querySelector(".outline-text");
    const originalText = textSpan.textContent;

    // Trim whitespace
    newText = newText.trim();

    // If empty, revert to original
    if (!newText) {
      newText = originalText;
    }

    // Update text content
    textSpan.textContent = newText;

    // Remove event listeners
    input.removeEventListener("keydown", input._handleKeydown);
    input.removeEventListener("blur", input._handleBlur);

    // Remove input and editing class
    input.remove();
    li.classList.remove("editing");

    // Show child-count when saving edit
    const childCount = li.querySelector(".child-count");
    if (childCount) {
      childCount.style.display = "";
    }

    // Show hover buttons when saving edit
    const hoverButtons = li.querySelector(".outline-hover-buttons");
    if (hoverButtons) {
      hoverButtons.style.display = "";
    }

    // Restore focus to li
    li.focus();

    // Emit event if text actually changed
    if (newText !== originalText) {
      this.emit("outline:edit:save", {
        id: li.dataset.id,
        originalText: originalText,
        newText: newText
      });
    } else {
      this.emit("outline:edit:cancel", {
        id: li.dataset.id
      });
    }
  }

  addSiblingTodo(li) {
    // Find the parent container (either main ul or parent li's sublist)
    const parentContainer = li.parentNode;
    const parentLi = parentContainer.closest("li");

    // Create new todo item
    const newLi = document.createElement("li");
    newLi.tabIndex = 0;
    newLi.dataset.id = crypto.randomUUID();

    // Create label span
    const label = document.createElement("span");
    label.className = "outline-label";
    label.textContent = "TODO";

    // Create text span with placeholder
    const spanText = document.createElement("span");
    spanText.className = "outline-text";
    spanText.textContent = "New todo";

        newLi.appendChild(label);
    // Add a space between label and text (like in HTML)
    newLi.appendChild(document.createTextNode(" "));
    newLi.appendChild(spanText);

    // Add hover buttons
    this.addHoverButtons(newLi);

    // Drag handles are no longer needed - entire items are draggable

    // Insert after current li
    li.after(newLi);

    // Update parent child count if needed
    if (parentLi) {
      this.updateChildCount(parentLi);
      // Also update any grandparent counts
      let grandparentLi = parentLi.parentNode.closest("li");
      while (grandparentLi) {
        this.updateChildCount(grandparentLi);
        grandparentLi = grandparentLi.parentNode.closest("li");
      }
    }

    // Enter edit mode immediately
    this.enterEditMode(newLi);

    this.emit("outline:add", {
      text: "New todo",
      id: newLi.dataset.id,
      parentId: parentLi?.dataset.id || null
    });
  }

  cycleCollapsedState(li) {
    const sublist = li.querySelector("ul");

    // Count actual child li elements
    const childItems = sublist ? Array.from(sublist.children).filter(c => c.tagName === "LI") : [];

    if (childItems.length === 0) {
      // No children, nothing to collapse/expand
      return;
    }

    if (li.classList.contains("collapsed")) {
      // Currently collapsed, expand it
      this.expandItem(li);
    } else {
      // Currently expanded (or normal), collapse it
      this.collapseItem(li);
    }
  }

  navigateToNextItem(li) {
    // Traverse up the hierarchy until we find a parent with a next sibling
    let currentLi = li;

    while (currentLi) {
      const parentUl = currentLi.parentNode;
      const parentLi = parentUl.closest("li");

      if (!parentLi) {
        // We've reached the root level, no more navigation possible
        return;
      }

      // Get siblings of the parent
      const parentSiblings = Array.from(parentLi.parentNode.children).filter(c => c.tagName === "LI");
      const parentIdx = parentSiblings.indexOf(parentLi);

      if (parentIdx < parentSiblings.length - 1) {
        // Found a parent with a next sibling, focus on it
        parentSiblings[parentIdx + 1].focus();
        return;
      }

      // This parent is also the last child, continue traversing up
      currentLi = parentLi;
    }
  }

  openItem(li) {
    this.emit("outline:open", {
      id: li.dataset.id,
      text: li.querySelector(".outline-text")?.textContent
    });
  }

  cycleTodoStateForward(li) {
    const label = li.querySelector(".outline-label");
    if (!label) return;

    // Get current status index
    const currentText = label.textContent.trim();
    const currentIndex = this.options.statusLabels.findIndex(status => status.label === currentText);

    let nextState;

    if (li.classList.contains("no-label")) {
      // no label → first status
      nextState = `status-0`;
      
      // Check if we can complete this parent
      if (!this.canCompleteParent(li, nextState)) {
        this.showPermissionDeniedFeedback(li, 'complete-with-incomplete-children');
        return;
      }
      
      li.classList.remove("no-label");
      label.style.display = "";
      label.textContent = this.options.statusLabels[0].label;
    } else if (currentIndex >= 0 && currentIndex < this.options.statusLabels.length - 1 && !this.options.statusLabels[currentIndex].isEndState) {
      // current status → next status
      nextState = `status-${currentIndex + 1}`;
      
      // Check if we can complete this parent
      if (!this.canCompleteParent(li, nextState)) {
        this.showPermissionDeniedFeedback(li, 'complete-with-incomplete-children');
        return;
      }
      
      label.textContent = this.options.statusLabels[currentIndex + 1].label;

              // Check if this should be treated as completed
        if (this.options.statusLabels[currentIndex + 1].isEndState) {
          li.classList.add("completed");
        } else {
          li.classList.remove("completed");
        }
    } else if (currentIndex >= 0 && this.options.statusLabels[currentIndex].isEndState) {
      // Check if there are more end states after this one
      const remainingEndStates = this.options.statusLabels
        .slice(currentIndex + 1)
        .filter(status => status.isEndState);

      if (remainingEndStates.length > 0) {
        // Go to next end state
        const nextEndStateIndex = this.options.statusLabels.findIndex((status, index) =>
          index > currentIndex && status.isEndState
        );
        nextState = `status-${nextEndStateIndex}`;
        
        // Check if we can complete this parent
        if (!this.canCompleteParent(li, nextState)) {
          this.showPermissionDeniedFeedback(li, 'complete-with-incomplete-children');
          return;
        }
        
        label.textContent = this.options.statusLabels[nextEndStateIndex].label;
        li.classList.add("completed");
      } else {
        // No more end states, go to no-label
        nextState = "none";
        li.classList.remove("completed");
        li.classList.add("no-label");
        label.style.display = "none";
      }
    } else {
      // fallback: no label → first status
      nextState = `status-0`;
      
      // Check if we can complete this parent
      if (!this.canCompleteParent(li, nextState)) {
        this.showPermissionDeniedFeedback(li, 'complete-with-incomplete-children');
        return;
      }
      
      li.classList.remove("no-label");
      label.style.display = "";
      label.textContent = this.options.statusLabels[0].label;
    }

    this.emit("outline:toggle", {
      id: li.dataset.id,
      to: nextState,
      completed: li.classList.contains("completed"),
      hasLabel: !li.classList.contains("no-label")
    });

    // Update parent counters
    let parentLi = li.parentNode.closest("li");
    while(parentLi) {
      this.updateChildCount(parentLi);
      parentLi = parentLi.parentNode.closest("li");
    }

    // Update hover buttons to reflect new state
    this.updateHoverButtons(li);
  }

  cycleTodoStateBackward(li) {
    const label = li.querySelector(".outline-label");
    if (!label) return;

    // Get current status index
    const currentText = label.textContent.trim();
    const currentIndex = this.options.statusLabels.findIndex(status => status.label === currentText);

    let nextState;

    if (li.classList.contains("no-label")) {
      // no label → last end state
      const endStateIndices = this.options.statusLabels
        .map((status, index) => status.isEndState ? index : -1)
        .filter(index => index !== -1);
      const lastEndStateIndex = endStateIndices[endStateIndices.length - 1];
      nextState = `status-${lastEndStateIndex}`;
      
      // Check if we can complete this parent
      if (!this.canCompleteParent(li, nextState)) {
        this.showPermissionDeniedFeedback(li, 'complete-with-incomplete-children');
        return;
      }
      
      li.classList.remove("no-label");
      li.classList.add("completed");
      label.style.display = "";
      label.textContent = this.options.statusLabels[lastEndStateIndex].label;
    } else if (currentIndex > 0) {
      // current status → previous status
      nextState = `status-${currentIndex - 1}`;
      
      // Check if we can complete this parent
      if (!this.canCompleteParent(li, nextState)) {
        this.showPermissionDeniedFeedback(li, 'complete-with-incomplete-children');
        return;
      }
      
      label.textContent = this.options.statusLabels[currentIndex - 1].label;

              // Check if this should be treated as completed
        if (this.options.statusLabels[currentIndex - 1].isEndState) {
          li.classList.add("completed");
        } else {
          li.classList.remove("completed");
        }
    } else if (currentIndex === 0) {
      // first status → no label
      nextState = "none";
      li.classList.add("no-label");
      li.classList.remove("completed");
      label.style.display = "none";
    } else {
      // fallback: no label → last end state
      const endStateIndices = this.options.statusLabels
        .map((status, index) => status.isEndState ? index : -1)
        .filter(index => index !== -1);
      const lastEndStateIndex = endStateIndices[endStateIndices.length - 1];
      nextState = `status-${lastEndStateIndex}`;
      
      // Check if we can complete this parent
      if (!this.canCompleteParent(li, nextState)) {
        this.showPermissionDeniedFeedback(li, 'complete-with-incomplete-children');
        return;
      }
      
      li.classList.remove("no-label");
      li.classList.add("completed");
      label.style.display = "";
      label.textContent = this.options.statusLabels[lastEndStateIndex].label;
    }

    this.emit("outline:toggle", {
      id: li.dataset.id,
      to: nextState,
      completed: li.classList.contains("completed"),
      hasLabel: !li.classList.contains("no-label")
    });

    // Update parent counters
    let parentLi = li.parentNode.closest("li");
    while(parentLi) {
      this.updateChildCount(parentLi);
      parentLi = parentLi.parentNode.closest("li");
    }

    // Update hover buttons to reflect new state
    this.updateHoverButtons(li);
  }

  scheduleItem(li) {
    // Use the same logic as setScheduleDate but with current date
    const now = new Date();
    this.setScheduleDate(li, now);
  }

  addHoverButtons(li) {
    // Use TaskItem to handle button creation and setup
    const taskItem = TaskItem.fromElement(li, this);
    // TaskItem.initialize() handles all the button setup automatically
  }

  addHoverDelayHandlers(li, buttonsContainer) {
    let hoverTimeout;
    const delay = 600; // 600ms delay before showing buttons

    // Use mouseover instead of mouseenter to get better control over event bubbling
    li.addEventListener('mouseover', (e) => {
      const targetLi = e.target.closest('li');
      
      // Check if the event target is a child li element
      // If the target is a child li, don't show hover buttons for this parent
      // AND clear any pending timeout to prevent showing buttons later
      if (targetLi !== li) {
        // Clear any pending timeout since we're now hovering a child
        if (hoverTimeout) {
          clearTimeout(hoverTimeout);
          hoverTimeout = null;
        }
        // Also hide any currently visible hover buttons without data
        const buttonsWithoutData = buttonsContainer.querySelectorAll('.hover-button:not(.has-data)');
        buttonsWithoutData.forEach(btn => {
          btn.style.display = 'none';
        });
        // Show the container only if there are buttons with data
        const buttonsWithData = buttonsContainer.querySelectorAll('.hover-button.has-data');
        if (buttonsWithData.length > 0) {
          buttonsContainer.style.display = 'inline-flex';
        } else {
          buttonsContainer.style.display = 'none';
        }
        return;
      }

      // Clear any existing timeout
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
      }

      // Set timeout to show all buttons after delay
      hoverTimeout = setTimeout(() => {
        // Show all buttons on hover
        const allButtons = buttonsContainer.querySelectorAll('.hover-button');
        allButtons.forEach(btn => {
          btn.style.display = 'inline';
        });
        buttonsContainer.style.display = 'inline-flex';
      }, delay);
    });

    li.addEventListener('mouseout', (e) => {
      // Check if we're moving to a child element - if so, don't hide buttons yet
      const relatedTarget = e.relatedTarget;
      if (relatedTarget && li.contains(relatedTarget)) {
        return;
      }

      // Clear timeout and hide buttons without data immediately
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
        hoverTimeout = null;
      }

      // If a popup is active for this item, keep all buttons visible
      if (li.classList.contains('popup-active')) {
        const allButtons = buttonsContainer.querySelectorAll('.hover-button');
        allButtons.forEach(btn => {
          btn.style.display = 'inline';
        });
        buttonsContainer.style.display = 'inline-flex';
        return;
      }

      // Hide buttons without data, keep buttons with data visible
      const buttonsWithoutData = buttonsContainer.querySelectorAll('.hover-button:not(.has-data)');
      buttonsWithoutData.forEach(btn => {
        btn.style.display = 'none';
      });

      // Show the container if there are still visible buttons (with data)
      const buttonsWithData = buttonsContainer.querySelectorAll('.hover-button.has-data');
      if (buttonsWithData.length > 0 || li.classList.contains('popup-active')) {
        buttonsContainer.style.display = 'inline-flex';
      } else {
        buttonsContainer.style.display = 'none';
      }
    });
  }

  updateHoverButtonsVisibility(li) {
    const buttonsContainer = li.querySelector('.outline-hover-buttons');
    if (!buttonsContainer) return;

    // Always show buttons with data
    const buttonsWithData = buttonsContainer.querySelectorAll('.hover-button.has-data');
    buttonsWithData.forEach(btn => {
      btn.style.display = 'inline';
    });

    // Hide buttons without data (unless popup is active)
    const buttonsWithoutData = buttonsContainer.querySelectorAll('.hover-button:not(.has-data)');
    buttonsWithoutData.forEach(btn => {
      if (!li.classList.contains('popup-active')) {
        btn.style.display = 'none';
      } else {
        btn.style.display = 'inline';
      }
    });

    // Show the container if there are visible buttons
    const visibleButtons = buttonsContainer.querySelectorAll('.hover-button[style*="inline"]');
    if (visibleButtons.length > 0 || li.classList.contains('popup-active')) {
      buttonsContainer.style.display = 'inline-flex';
    } else {
      buttonsContainer.style.display = 'none';
    }
  }

  updateHoverButtons(li) {
    const priorityBtn = li.querySelector(".priority-button");
    const blockedBtn = li.querySelector(".blocked-button");
    const dueBtn = li.querySelector(".due-button");
    const scheduleBtn = li.querySelector(".schedule-button");
    const assignBtn = li.querySelector(".assign-button");
    const tagsBtn = li.querySelector(".tags-button");
    const commentsBtn = li.querySelector(".comments-button");
    const worklogBtn = li.querySelector(".worklog-button");
    const archiveBtn = li.querySelector(".archive-button");
    const editBtn = li.querySelector(".edit-button");
    const openBtn = li.querySelector(".open-button");

    // Only require the always-enabled buttons to exist
    if (!editBtn || !openBtn) return;

    let hasAnyData = false;

    // Update priority button (if enabled)
    if (priorityBtn) {
      const isPriority = li.classList.contains("priority");
      if (isPriority) {
        priorityBtn.textContent = "priority";
        priorityBtn.classList.add("has-data");
        hasAnyData = true;
      } else {
        priorityBtn.innerHTML = "<u>p</u>riority";
        priorityBtn.classList.remove("has-data");
      }
    }

    // Update blocked button (if enabled)
    if (blockedBtn) {
      const isBlocked = li.classList.contains("blocked");
      if (isBlocked) {
        blockedBtn.textContent = "blocked";
        blockedBtn.classList.add("has-data");
        hasAnyData = true;
      } else {
        blockedBtn.innerHTML = "blo<u>c</u>ked";
        blockedBtn.classList.remove("has-data");
      }
    }

    // Update due button (if enabled)
    if (dueBtn) {
      const dueSpan = li.querySelector(".outline-due");
      if (dueSpan && dueSpan.textContent.trim()) {
        dueBtn.textContent = `due ${dueSpan.textContent.trim()}`;
        dueBtn.classList.add("has-data");
        hasAnyData = true;
      } else {
        dueBtn.innerHTML = "<u>d</u>ue";
        dueBtn.classList.remove("has-data");
      }
    }

    // Update schedule button (if enabled)
    if (scheduleBtn) {
      const scheduleSpan = li.querySelector(".outline-schedule");
      if (scheduleSpan && scheduleSpan.textContent.trim()) {
        scheduleBtn.textContent = `on ${scheduleSpan.textContent.trim()}`;
        scheduleBtn.classList.add("has-data");
        hasAnyData = true;
      } else {
        scheduleBtn.innerHTML = "<u>s</u>chedule";
        scheduleBtn.classList.remove("has-data");
      }
    }

    // Update assign button (if enabled)
    if (assignBtn) {
      const assignSpan = li.querySelector(".outline-assign");
      if (assignSpan && assignSpan.textContent.trim()) {
        assignBtn.textContent = `@${assignSpan.textContent.trim()}`;
        assignBtn.classList.add("has-data");
        hasAnyData = true;
      } else {
        assignBtn.innerHTML = "<u>a</u>ssign";
        assignBtn.classList.remove("has-data");
      }
    }

    // Update tags button (if enabled)
    if (tagsBtn) {
      const tagsSpan = li.querySelector(".outline-tags");
      if (tagsSpan && tagsSpan.textContent.trim()) {
        const tags = tagsSpan.textContent.trim().split(' ').filter(tag => tag.length > 0);
        tagsBtn.textContent = tags.map(tag => `#${tag}`).join(' ');
        tagsBtn.classList.add("has-data");
        hasAnyData = true;
      } else {
        tagsBtn.innerHTML = "<u>t</u>ags";
        tagsBtn.classList.remove("has-data");
      }
    }

    // Update comments button (if enabled) - event-only, no has-data class
    if (commentsBtn) {
      commentsBtn.innerHTML = "<u>c</u>omment";
      commentsBtn.classList.remove("has-data");
    }

    // Update worklog button (if enabled) - event-only, no has-data class
    if (worklogBtn) {
      worklogBtn.innerHTML = "<u>w</u>orklog";
      worklogBtn.classList.remove("has-data");
    }


    // Update archive button (if enabled)
    if (archiveBtn) {
      const hasChildren = !!li.querySelector("ul > li");
      archiveBtn.innerHTML = hasChildren ? "a<u>r</u>chive…" : "a<u>r</u>chive";
      archiveBtn.classList.remove("has-data");
    }


    // Edit button always shows "edit" and doesn't have data states
    editBtn.innerHTML = "<u>e</u>dit";
    editBtn.classList.remove("has-data"); // Edit button is never in "has-data" state

    // Open button always shows "open" and doesn't have data states
    openBtn.innerHTML = "<u>o</u>pen";
    openBtn.classList.remove("has-data"); // Open button is never in "has-data" state

    // Add/remove has-data class on the li element
    if (hasAnyData) {
      li.classList.add("has-data");
    } else {
      li.classList.remove("has-data");
    }

    // Update hover buttons visibility based on has-data state
    this.updateHoverButtonsVisibility(li);

    // Reorder buttons: set values first, then unset values
    this.reorderHoverButtons(li);
  }

  reorderHoverButtons(li) {
    const buttonsContainer = li.querySelector(".outline-hover-buttons");
    if (!buttonsContainer) return;

    // Build a sortable list of current buttons
    const buttons = Array.from(buttonsContainer.querySelectorAll('.hover-button'));

    // Desired priority within each group (has-data first group and no-data group)
    const rankByType = {
      open: 0,
      edit: 1,
      remove: 2,
      priority: 3,
      blocked: 4,
      schedule: 5,
      due: 6,      
      assign: 7,
      tags: 8,
      comments: 9,
      worklog: 10
    };

    const decorated = buttons.map((btn, index) => {
      const type = btn.getAttribute('data-type') || '';
      const hasDataRank = btn.classList.contains('has-data') ? 0 : 1; // 0 first
      const typeRank = rankByType.hasOwnProperty(type) ? rankByType[type] : 99;
      return { btn, index, hasDataRank, typeRank };
    });

    decorated.sort((a, b) => {
      if (a.hasDataRank !== b.hasDataRank) return a.hasDataRank - b.hasDataRank;
      if (a.typeRank !== b.typeRank) return a.typeRank - b.typeRank;
      return a.index - b.index; // stable fallback
    });

    // Re-append in sorted order
    buttons.forEach(btn => btn.remove());
    decorated.forEach(({ btn }) => buttonsContainer.appendChild(btn));
  }

  closeAllPopups(focusElement = null) {
    // Close popups from both document and the list container
    document.querySelectorAll('.outline-popup').forEach(popup => {
      // Clean up event listener if it exists
      if (popup._outsideClickHandler) {
        document.removeEventListener('click', popup._outsideClickHandler);
      }
      popup.remove();
    });

    // Also check within the list container specifically
    this.el.querySelectorAll('.outline-popup').forEach(popup => {
      // Clean up event listener if it exists
      if (popup._outsideClickHandler) {
        document.removeEventListener('click', popup._outsideClickHandler);
      }
      popup.remove();
    });

    // Remove popup-active class from all todo items and update hover buttons visibility
    this.el.querySelectorAll('li.popup-active').forEach(li => {
      li.classList.remove('popup-active');
      this.updateHoverButtonsVisibility(li);
    });

    if (focusElement) {
      focusElement.focus();
    }
  }

  positionPopup(popup, button) {
    // Ensure container has relative positioning for absolute popup positioning
    this.el.style.position = 'relative';
    this.el.appendChild(popup);

    // Get button position relative to the list container
    const containerRect = this.el.getBoundingClientRect();

    // Check if button is visible and has proper dimensions
    const buttonRect = button.getBoundingClientRect();
    
    
    if (buttonRect.width === 0 || buttonRect.height === 0) {
      // Button is not visible (hidden), position relative to the todo text instead
      const li = button.closest('li');
      if (li) {
        const textEl = li.querySelector('.outline-text') || li.querySelector('.outline-label') || li;
        const refRect = textEl.getBoundingClientRect();
        const left = refRect.left - containerRect.left;
        const top = refRect.bottom - containerRect.top + 5;
        popup.style.left = `${Math.max(0, left)}px`;
        popup.style.top = `${top}px`;
        return;
      }
    }

    const left = buttonRect.left - containerRect.left;
    const top = buttonRect.bottom - containerRect.top + 5;

    // Apply center-oriented positioning for all popups
    const positionedLeft = this.calculateCenterOrientedPosition(popup, left, containerRect.width);
    popup.style.left = `${positionedLeft}px`;
    popup.style.top = `${top}px`;
    
  }

  /**
   * Calculate the optimal left position for a popup to open towards the center
   * and minimize the chance of extending outside the screen
   */
  calculateCenterOrientedPosition(popup, buttonLeft, containerWidth) {
    // Get popup width - use different widths for different popup types
    let popupWidth;
    if (popup.classList.contains('notes-popup') || popup.classList.contains('comments-popup') || popup.classList.contains('worklog-popup')) {
      popupWidth = 200; // Match the min-width from CSS
    } else if (popup.classList.contains('dropdown-popup')) {
      popupWidth = 150; // Typical width for dropdown popups
    } else if (popup.classList.contains('date-popup')) {
      popupWidth = 200; // Width for date popup
    } else {
      popupWidth = 200; // Default width
    }

    // Check if popup would go off the right edge if positioned at button location
    const rightEdge = buttonLeft + popupWidth;
    
    if (rightEdge > containerWidth - 10) {
      // Popup would go off-screen, position it to the left to keep it visible
      const popupLeft = Math.max(0, containerWidth - popupWidth - 10);
      return popupLeft;
    } else {
      // Popup fits at button location, use button position
      return buttonLeft;
    }
  }

  showDuePopup(li, button) {
    this.showDateTimePopup(li, button, 'due');
  }

  showSchedulePopup(li, button) {
    this.showDateTimePopup(li, button, 'schedule');
  }

  showDateTimePopup(li, button, type) {
    this.closeAllPopups();

    // Add popup-active class to keep metadata visible
    li.classList.add('popup-active');
    this.updateHoverButtonsVisibility(li);

    const popup = document.createElement('div');
    popup.className = 'outline-popup date-popup';

    // Date input container with icon
    const dateContainer = document.createElement('div');
    dateContainer.style.cssText = 'display: flex; align-items: center; gap: 0.5rem;';

    // Date input
    const dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateInput.className = 'dropdown-input';
    dateInput.style.flex = '1';

    // Get current date/time if set, otherwise use today
    const existingSpan = li.querySelector(`.outline-${type}`);
    let initialDate = new Date();
    let hasTime = false;

    if (existingSpan && existingSpan.textContent.trim()) {
      const dateText = existingSpan.textContent.trim();
      console.log(`Parsing ${type} date text:`, dateText); // Debug

      // Check if the text includes time (format: "Jan 5 14:30" or "Jan 5, 14:30")
      hasTime = /\d{1,2}:\d{2}/.test(dateText);
      
      const currentYear = new Date().getFullYear();
      let parsedDate;

      if (hasTime) {
        // Try to parse full date with time
        // Handle formats like "Jan 5 14:30" or "Jan 5, 14:30"
        const dateWithYear = dateText.includes(currentYear.toString()) ? 
          dateText : 
          dateText.replace(/(\w{3}\s+\d{1,2}),?\s+/, `$1 ${currentYear} `);
        parsedDate = new Date(dateWithYear);
        
        if (!isNaN(parsedDate.getTime())) {
          initialDate = parsedDate;
        }
      } else if (dateText.includes(' ')) {
        // Format: "Jan 5" - date only
        const dateWithYear = `${dateText} ${currentYear}`;
        parsedDate = new Date(dateWithYear);

        if (!isNaN(parsedDate.getTime())) {
          const month = parsedDate.getMonth();
          const day = parsedDate.getDate();
          initialDate = new Date(currentYear, month, day);
        }
      } else {
        // Try direct parsing
        parsedDate = new Date(dateText);
        if (!isNaN(parsedDate.getTime())) {
          initialDate = parsedDate;
        }
      }

      console.log(`Parsed ${type} date:`, parsedDate, 'Valid:', !isNaN(parsedDate.getTime()), 'Has time:', hasTime);
    }

    // Set the initial input type and value
    if (hasTime) {
      dateInput.type = 'datetime-local';
      // Format for datetime-local: YYYY-MM-DDTHH:MM
      const year = initialDate.getFullYear();
      const month = String(initialDate.getMonth() + 1).padStart(2, '0');
      const day = String(initialDate.getDate()).padStart(2, '0');
      const hours = String(initialDate.getHours()).padStart(2, '0');
      const minutes = String(initialDate.getMinutes()).padStart(2, '0');
      dateInput.value = `${year}-${month}-${day}T${hours}:${minutes}`;
    } else {
      // Set the date input value
      const year = initialDate.getFullYear();
      const month = String(initialDate.getMonth() + 1).padStart(2, '0');
      const day = String(initialDate.getDate()).padStart(2, '0');
      dateInput.value = `${year}-${month}-${day}`;
    }

    // Time toggle icon button
    const timeIcon = document.createElement('button');
    timeIcon.type = 'button';
    timeIcon.className = 'hover-button time-icon';
    timeIcon.textContent = hasTime ? 'Only date' : 'Add time';
    timeIcon.title = hasTime ? 'Remove time (date only)' : 'Add time';
    timeIcon.style.padding = '0.3rem 0.6rem';

    // Prevent click events from bubbling up from the time icon
    timeIcon.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (dateInput.type === 'date') {
        // Switch to datetime-local
        const currentDate = dateInput.value;
        dateInput.type = 'datetime-local';
        if (currentDate) {
          // Default to 09:00
          dateInput.value = `${currentDate}T09:00`;
        }
        timeIcon.textContent = 'Only date';
        timeIcon.title = 'Remove time (date only)';
        
        // Re-add click prevention for the new input type
        dateInput.removeEventListener('click', dateInput._clickHandler);
        dateInput._clickHandler = (e) => e.stopPropagation();
        dateInput.addEventListener('click', dateInput._clickHandler);
      } else {
        // Switch back to date only
        const currentDateTime = dateInput.value;
        dateInput.type = 'date';
        if (currentDateTime) {
          dateInput.value = currentDateTime.split('T')[0];
        }
        timeIcon.textContent = 'Add time';
        timeIcon.title = 'Add time';
        
        // Re-add click prevention for the new input type
        dateInput.removeEventListener('click', dateInput._clickHandler);
        dateInput._clickHandler = (e) => e.stopPropagation();
        dateInput.addEventListener('click', dateInput._clickHandler);
      }
    });

    // Prevent click events from bubbling up from the date input
    dateInput._clickHandler = (e) => e.stopPropagation();
    dateInput.addEventListener('click', dateInput._clickHandler);

    dateContainer.appendChild(dateInput);
    dateContainer.appendChild(timeIcon);
    popup.appendChild(dateContainer);

    // Button container
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '0.5rem';
    buttonContainer.style.marginTop = '0.5rem';

    // Confirm button
    const confirmButton = document.createElement('button');
    confirmButton.textContent = 'Set';
    confirmButton.className = 'hover-button';
    confirmButton.style.padding = '0.3rem 0.6rem';
    confirmButton.style.flex = '1';
    confirmButton.type = 'button';

    // Handle confirm button click
    const handleConfirm = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (dateInput.value) {
        let selectedDate;
        
        if (dateInput.type === 'datetime-local') {
          // Parse datetime-local format: YYYY-MM-DDTHH:MM
          selectedDate = new Date(dateInput.value);
          // Mark that time was explicitly set
          selectedDate._explicitTime = true;
        } else {
          // Parse date format: YYYY-MM-DD
          selectedDate = new Date(dateInput.value + 'T00:00:00');
        }
        
        if (type === 'due') {
          this.setDueDate(li, selectedDate);
        } else {
          this.setScheduleDate(li, selectedDate);
        }
        this.closeAllPopups();
      }
    };

    confirmButton.addEventListener('click', handleConfirm);
    confirmButton.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleConfirm(e);
      }
    });

    // Clear button
    const clearButton = document.createElement('button');
    clearButton.textContent = 'Clear';
    clearButton.className = 'hover-button clear-date';
    clearButton.style.padding = '0.3rem 0.6rem';
    clearButton.style.flex = '1';
    clearButton.type = 'button';

    const handleClear = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (type === 'due') {
        this.clearDueDate(li);
      } else {
        this.clearScheduleDate(li);
      }
      this.closeAllPopups();
    };

    clearButton.addEventListener('click', handleClear);
    clearButton.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClear(e);
      }
    });

    buttonContainer.appendChild(confirmButton);
    buttonContainer.appendChild(clearButton);
    popup.appendChild(buttonContainer);

    // Keyboard handling
    dateInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeAllPopups(li);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirm(e);
      }
    });

    // Position popup and setup
    this.positionPopup(popup, button);
    setTimeout(() => dateInput.focus(), 0);
    this.currentPopup = popup;

    // Outside click handling
    setTimeout(() => {
      const handleOutsideClick = (e) => {
        // Don't close if clicking inside the popup, on any date/datetime input, or within the web component
        const isInsidePopup = popup.contains(e.target);
        const isDateInput = e.target.matches('input[type="date"]') || e.target.matches('input[type="datetime-local"]');
        const isInOutlineList = e.target.closest('outline-list');
        const isPopupElement = e.target.closest('.outline-popup');
        
        if (isInsidePopup || isDateInput || isInOutlineList || isPopupElement) {
          return;
        }
        
        this.closeAllPopups(li);
        document.removeEventListener('click', handleOutsideClick);
      };

      document.addEventListener('click', handleOutsideClick);
      popup._outsideClickHandler = handleOutsideClick;
    }, 100);
  }

  setScheduleDate(li, date) {
    const textSpan = li.querySelector(".outline-text");
    if (!textSpan) return;

    let scheduleSpan = li.querySelector(".outline-schedule");
    if (!scheduleSpan) {
      scheduleSpan = document.createElement("span");
      scheduleSpan.className = "outline-schedule";
      scheduleSpan.style.display = "none"; // Hide the span, show in button
      // Insert after buttons container if it exists, otherwise after text
      const buttonsContainer = li.querySelector(".outline-hover-buttons");
      if (buttonsContainer) {
        buttonsContainer.after(scheduleSpan);
      } else {
        textSpan.after(scheduleSpan);
      }
    }

    // Format with time if time was explicitly set (not default midnight)
    const hasTime = (date.getHours() !== 0 || date.getMinutes() !== 0) || 
                   (date._explicitTime === true);
    let timestamp;
    
    if (hasTime) {
      timestamp = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      }) + ' ' + date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } else {
      timestamp = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
    }
    
    scheduleSpan.textContent = ` ${timestamp}`;

    // Update the hover button to show the data
    this.updateHoverButtons(li);

    // Restore focus to the todo item
    li.focus();

    this.emit("outline:schedule", {
      id: li.dataset.id,
      text: textSpan.textContent,
      timestamp: date.toISOString()
    });
  }

  clearScheduleDate(li) {
    const textSpan = li.querySelector(".outline-text");
    if (!textSpan) return;

    // Remove the schedule span
    const scheduleSpan = li.querySelector(".outline-schedule");
    if (scheduleSpan) {
      scheduleSpan.remove();
    }

    // Update the hover button to show the data
    this.updateHoverButtons(li);

    // Restore focus to the todo item
    li.focus();

    this.emit("outline:schedule", {
      id: li.dataset.id,
      text: textSpan.textContent,
      timestamp: null
    });
  }

  setDueDate(li, date) {
    const textSpan = li.querySelector(".outline-text");
    if (!textSpan) return;

    let dueSpan = li.querySelector(".outline-due");
    if (!dueSpan) {
      dueSpan = document.createElement("span");
      dueSpan.className = "outline-due";
      dueSpan.style.display = "none"; // Hide the span, show in button
      // Insert after buttons container if it exists, otherwise after text
      const buttonsContainer = li.querySelector(".outline-hover-buttons");
      if (buttonsContainer) {
        buttonsContainer.after(dueSpan);
      } else {
        textSpan.after(dueSpan);
      }
    }

    // Format with time if time was explicitly set (not default midnight)
    const hasTime = (date.getHours() !== 0 || date.getMinutes() !== 0) || 
                   (date._explicitTime === true);
    let timestamp;
    
    if (hasTime) {
      timestamp = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      }) + ' ' + date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } else {
      timestamp = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
    }
    
    dueSpan.textContent = ` ${timestamp}`;

    // Update the hover button to show the data
    this.updateHoverButtons(li);

    // Restore focus to the todo item
    li.focus();

    this.emit("outline:due", {
      id: li.dataset.id,
      text: textSpan.textContent,
      timestamp: date.toISOString()
    });
  }

  clearDueDate(li) {
    const textSpan = li.querySelector(".outline-text");
    if (!textSpan) return;

    // Remove the due span
    const dueSpan = li.querySelector(".outline-due");
    if (dueSpan) {
      dueSpan.remove();
    }

    // Update the hover button to show the data
    this.updateHoverButtons(li);

    // Restore focus to the todo item
    li.focus();

    this.emit("outline:due", {
      id: li.dataset.id,
      text: textSpan.textContent,
      timestamp: null
    });
  }

  showAssignPopup(li, button) {
    this.closeAllPopups();

    // Add popup-active class to keep metadata visible
    li.classList.add('popup-active');
    this.updateHoverButtonsVisibility(li);

    const popup = document.createElement('div');
    popup.className = 'outline-popup dropdown-popup';

    // Get current assignee
    const existingAssignSpan = li.querySelector('.outline-assign');
    const currentAssignee = existingAssignSpan ?
      existingAssignSpan.textContent.trim().replace(/^@/, '') : null;

    // Add "None" option to remove assignment
    const noneItem = document.createElement('div');
    noneItem.className = 'dropdown-item';
    noneItem.textContent = 'None';
    noneItem.setAttribute('tabindex', '0');
    if (!currentAssignee) noneItem.classList.add('selected');

    noneItem.addEventListener('click', (e) => {
      e.stopPropagation();
      this.removeAssignee(li);
      this.closeAllPopups();
    });

    noneItem.addEventListener('keydown', (e) => {
      this.handleDropdownKeydown(e, noneItem, () => {
        this.removeAssignee(li);
        this.closeAllPopups();
      }, li);
    });

    popup.appendChild(noneItem);

    // Assignee options from configuration
    this.options.assignees.forEach(assignee => {
      const item = document.createElement('div');
      item.className = 'dropdown-item';
      item.textContent = assignee;
      item.setAttribute('tabindex', '0');
      if (currentAssignee === assignee) item.classList.add('selected');

      item.addEventListener('click', (e) => {
        e.stopPropagation();
        this.setAssignee(li, assignee);
        this.closeAllPopups();
      });

      item.addEventListener('keydown', (e) => {
        this.handleDropdownKeydown(e, item, () => {
          this.setAssignee(li, assignee);
          this.closeAllPopups();
        }, li);
      });

      popup.appendChild(item);
    });

    // Position popup relative to the list container
    this.positionPopup(popup, button);

    // Focus first item or current selection
    setTimeout(() => {
      const selectedItem = popup.querySelector('.dropdown-item.selected') ||
                          popup.querySelector('.dropdown-item');
      if (selectedItem) selectedItem.focus();
    }, 0);

    // Close on outside click
    setTimeout(() => {
      const handleOutsideClick = (e) => {
        // Don't close if clicking inside the popup, on any popup element, or within the web component
        const isInsidePopup = popup.contains(e.target);
        const isInOutlineList = e.target.closest('outline-list');
        const isPopupElement = e.target.closest('.outline-popup');
        
        // For shadow DOM: check if the actual clicked element (using composedPath) is inside the popup
        let isInsideShadowPopup = false;
        if (e.composedPath) {
          const path = e.composedPath();
          isInsideShadowPopup = path.some(element => 
            element.nodeType === Node.ELEMENT_NODE && 
            (element.classList?.contains('outline-popup') || popup.contains(element))
          );
        }
        
        if (isInsidePopup || isInOutlineList || isPopupElement || isInsideShadowPopup) {
          return;
        }
        
        // Close popup and remove listener
        this.closeAllPopups(li);
        document.removeEventListener('click', handleOutsideClick);
      };

      document.addEventListener('click', handleOutsideClick);
      
      // Store reference to remove listener when popup closes
      popup._outsideClickHandler = handleOutsideClick;
    }, 100);
  }

  handleDropdownKeydown(e, item, selectCallback, li) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectCallback();
    } else if (e.key === 'ArrowDown' || (e.ctrlKey && e.key === 'n') || e.key === 'j') {
      e.preventDefault();
      const nextItem = item.nextElementSibling;
      if (nextItem) nextItem.focus();
    } else if (e.key === 'ArrowUp' || (e.ctrlKey && e.key === 'p') || e.key === 'k') {
      e.preventDefault();
      const prevItem = item.previousElementSibling;
      if (prevItem) prevItem.focus();
    } else if (e.key === 'Escape') {
      this.closeAllPopups(li);
    }
  }

  removeAssignee(li) {
    const assignSpan = li.querySelector(".outline-assign");
    if (assignSpan) {
      assignSpan.remove();
    }

    // Update hover buttons
    this.updateHoverButtons(li);

    // Restore focus to the todo item
    li.focus();

    this.emit("outline:assign", {
      id: li.dataset.id,
      text: li.querySelector(".outline-text").textContent,
      assignee: null
    });
  }

  setAssignee(li, assignee) {
    const textSpan = li.querySelector(".outline-text");
    if (!textSpan) return;

    let assignSpan = li.querySelector(".outline-assign");
    if (!assignSpan) {
      assignSpan = document.createElement("span");
      assignSpan.className = "outline-assign";
      assignSpan.style.display = "none"; // Hide the span, show in button
      // Insert after buttons container if it exists, otherwise after text
      const buttonsContainer = li.querySelector(".outline-hover-buttons");
      if (buttonsContainer) {
        buttonsContainer.after(assignSpan);
      } else {
        textSpan.after(assignSpan);
      }
    }

    assignSpan.textContent = ` ${assignee}`;

    // Update the hover button to show the data
    this.updateHoverButtons(li);

    // Restore focus to the todo item
    li.focus();

    this.emit("outline:assign", {
      id: li.dataset.id,
      text: textSpan.textContent,
      assignee: assignee
    });
  }

  showTagsPopup(li, button) {
    this.closeAllPopups();

    // Add popup-active class to keep metadata visible
    li.classList.add('popup-active');
    this.updateHoverButtonsVisibility(li);

    const popup = document.createElement('div');
    popup.className = 'outline-popup dropdown-popup tags-popup';

    // Get current tags
    const existingTagsSpan = li.querySelector('.outline-tags');
    const currentTags = existingTagsSpan ?
      existingTagsSpan.textContent.trim().split(/\s+/).map(tag => tag.replace(/^#/, '')) : [];

    // Input for adding new tags
    const input = document.createElement('input');
    input.className = 'dropdown-input';
    input.placeholder = 'Add new tag...';
    popup.appendChild(input);

    // Tag options from configuration + any existing tags not in config
    const allTags = [...new Set([...this.options.tags, ...currentTags])];

    allTags.forEach(tag => {
      const item = document.createElement('div');
      item.className = 'dropdown-item tag-item';
      item.setAttribute('tabindex', '0');

      // Checkbox for multiselect
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = currentTags.includes(tag);
      checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        this.toggleTag(li, tag, checkbox.checked);
      });

      const label = document.createElement('label');
      label.textContent = tag;
      label.prepend(checkbox);

      item.appendChild(label);

      // Handle click on item (toggle checkbox)
      item.addEventListener('click', (e) => {
        // Prevent the default checkbox behavior and handle it ourselves
        if (e.target === checkbox) {
          // Let the checkbox handle its own click, but update our state
          setTimeout(() => {
            this.toggleTag(li, tag, checkbox.checked);
          }, 0);
        } else {
          // Clicking anywhere else on the item toggles the checkbox
          e.preventDefault();
          checkbox.checked = !checkbox.checked;
          this.toggleTag(li, tag, checkbox.checked);
        }
      });

      // Handle keyboard navigation
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          checkbox.checked = !checkbox.checked;
          this.toggleTag(li, tag, checkbox.checked);
        } else if (e.key === 'ArrowDown' || (e.ctrlKey && e.key === 'n') || e.key === 'j') {
          e.preventDefault();
          const nextItem = item.nextElementSibling || input;
          nextItem.focus();
        } else if (e.key === 'ArrowUp' || (e.ctrlKey && e.key === 'p') || e.key === 'k') {
          e.preventDefault();
          const prevItem = item.previousElementSibling;
          if (prevItem && prevItem !== input) {
            prevItem.focus();
          } else {
            input.focus();
          }
        } else if (e.key === 'Escape') {
          this.closeAllPopups(li);
        }
      });

      popup.appendChild(item);
    });

    // Handle input for new tags
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const newTag = input.value.trim();
        if (newTag && !allTags.includes(newTag)) {
          this.addNewTag(li, newTag);
          input.value = '';
          // Rebuild popup to include new tag
          setTimeout(() => this.showTagsPopup(li, button), 0);
        }
      } else if (e.key === 'ArrowDown' || (e.ctrlKey && e.key === 'n') || e.key === 'j') {
        e.preventDefault();
        const firstItem = popup.querySelector('.tag-item');
        if (firstItem) firstItem.focus();
      } else if (e.key === 'ArrowUp' || (e.ctrlKey && e.key === 'p') || e.key === 'k') {
        e.preventDefault();
        const lastItem = popup.querySelector('.tag-item:last-child');
        if (lastItem) lastItem.focus();
      } else if (e.key === 'Escape') {
        this.closeAllPopups(li);
      }
    });

    // Position popup relative to the list container
    this.positionPopup(popup, button);

    // Focus input
    setTimeout(() => input.focus(), 0);

    // Store reference for cleanup
    this.currentPopup = popup;

    // Close on outside click
    setTimeout(() => {
      const handleOutsideClick = (e) => {
        // Don't close if clicking inside the popup, on any popup element, or within the web component
        const isInsidePopup = popup.contains(e.target);
        const isInOutlineList = e.target.closest('outline-list');
        const isPopupElement = e.target.closest('.outline-popup');
        
        // For shadow DOM: check if the actual clicked element (using composedPath) is inside the popup
        let isInsideShadowPopup = false;
        if (e.composedPath) {
          const path = e.composedPath();
          isInsideShadowPopup = path.some(element => 
            element.nodeType === Node.ELEMENT_NODE && 
            (element.classList?.contains('outline-popup') || popup.contains(element))
          );
        }
        
        if (isInsidePopup || isInOutlineList || isPopupElement || isInsideShadowPopup) {
          return;
        }
        
        // Close popup and remove listener
        this.closeAllPopups(li);
        document.removeEventListener('click', handleOutsideClick);
      };

      document.addEventListener('click', handleOutsideClick);

      // Store reference to remove listener when popup closes
      popup._outsideClickHandler = handleOutsideClick;
    }, 100); // Increased timeout to ensure popup is ready
  }

  showCommentsPopup(li, button) {
    this.closeAllPopups();

    // Keep metadata visible
    li.classList.add('popup-active');
    this.updateHoverButtonsVisibility(li);

    const popup = document.createElement('div');
    popup.className = 'outline-popup date-popup comments-popup';

    const heading = document.createElement('div');
    heading.className = 'heading';
    heading.textContent = 'Add Comment';
    popup.appendChild(heading);

    const textarea = document.createElement('textarea');
    textarea.className = 'dropdown-input comments-textarea';
    textarea.placeholder = 'Add a comment to the discussion…';
    textarea.style.padding = '0.5rem';
    textarea.rows = 6;
    textarea.style.minHeight = '150px';
    textarea.style.resize = 'vertical';
    textarea.style.width = '200px';
    popup.appendChild(textarea);

    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '0.5rem';
    buttonContainer.style.marginTop = '0.5rem';
    buttonContainer.style.justifyContent = 'flex-end';

    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Add Comment';
    saveBtn.className = 'hover-button';
    saveBtn.style.padding = '0.3rem 0.6rem';
    saveBtn.style.flex = '1';
    saveBtn.type = 'button';
    saveBtn.setAttribute('tabindex', '0');

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.className = 'hover-button';
    cancelBtn.style.padding = '0.3rem 0.6rem';
    cancelBtn.style.flex = '1';
    cancelBtn.type = 'button';
    cancelBtn.setAttribute('tabindex', '0');

    const handleSave = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.addComment(li, textarea.value.trim());
      this.closeAllPopups();
    };
    const handleCancel = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.closeAllPopups(li);
    };
    saveBtn.addEventListener('click', handleSave);
    cancelBtn.addEventListener('click', handleCancel);

    buttonContainer.appendChild(saveBtn);
    buttonContainer.appendChild(cancelBtn);
    popup.appendChild(buttonContainer);

    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeAllPopups(li);
      } else if (e.key === 'Enter' && e.shiftKey) {
        // allow newline
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleSave(e);
      } else if (e.key === 'Tab') {
        // Allow normal tab navigation to buttons
      }
    });

    saveBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSave(e); }
      if (e.key === 'Escape') { this.closeAllPopups(li); }
    });

    cancelBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCancel(e); }
      if (e.key === 'Escape') { this.closeAllPopups(li); }
    });

    this.positionPopup(popup, button);
    setTimeout(() => textarea.focus(), 0);
    this.currentPopup = popup;

    setTimeout(() => {
      const handleOutsideClick = (e) => {
        const isInsidePopup = popup.contains(e.target);
        const isInOutlineList = e.target.closest('outline-list');
        const isPopupElement = e.target.closest('.outline-popup');
        
        // For shadow DOM: check if the actual clicked element (using composedPath) is inside the popup
        let isInsideShadowPopup = false;
        if (e.composedPath) {
          const path = e.composedPath();
          isInsideShadowPopup = path.some(element => 
            element.nodeType === Node.ELEMENT_NODE && 
            (element.classList?.contains('outline-popup') || popup.contains(element))
          );
        }
        
        if (isInsidePopup || isInOutlineList || isPopupElement || isInsideShadowPopup) return;
        this.closeAllPopups(li);
        document.removeEventListener('click', handleOutsideClick);
      };
      document.addEventListener('click', handleOutsideClick);
      popup._outsideClickHandler = handleOutsideClick;
    }, 100);
  }

  showWorklogPopup(li, button) {
    this.closeAllPopups();

    // Keep metadata visible
    li.classList.add('popup-active');
    this.updateHoverButtonsVisibility(li);

    const popup = document.createElement('div');
    popup.className = 'outline-popup date-popup worklog-popup';

    const heading = document.createElement('div');
    heading.className = 'heading';
    heading.textContent = 'Add to my worklog';
    popup.appendChild(heading);

    const textarea = document.createElement('textarea');
    textarea.className = 'dropdown-input worklog-textarea';
    textarea.placeholder = 'Add a work log entry…';
    textarea.style.padding = '0.5rem';
    textarea.rows = 6;
    textarea.style.minHeight = '150px';
    textarea.style.resize = 'vertical';
    textarea.style.width = '200px';
    popup.appendChild(textarea);

    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '0.5rem';
    buttonContainer.style.marginTop = '0.5rem';
    buttonContainer.style.justifyContent = 'flex-end';

    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Add Entry';
    saveBtn.className = 'hover-button';
    saveBtn.style.padding = '0.3rem 0.6rem';
    saveBtn.style.flex = '1';
    saveBtn.type = 'button';
    saveBtn.setAttribute('tabindex', '0');

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.className = 'hover-button';
    cancelBtn.style.padding = '0.3rem 0.6rem';
    cancelBtn.style.flex = '1';
    cancelBtn.type = 'button';
    cancelBtn.setAttribute('tabindex', '0');

    const handleSave = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.addWorklogEntry(li, textarea.value.trim());
      this.closeAllPopups();
    };
    const handleCancel = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.closeAllPopups(li);
    };
    saveBtn.addEventListener('click', handleSave);
    cancelBtn.addEventListener('click', handleCancel);

    buttonContainer.appendChild(saveBtn);
    buttonContainer.appendChild(cancelBtn);
    popup.appendChild(buttonContainer);

    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeAllPopups(li);
      } else if (e.key === 'Enter' && e.shiftKey) {
        // allow newline
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleSave(e);
      } else if (e.key === 'Tab') {
        // Allow normal tab navigation to buttons
      }
    });

    saveBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSave(e); }
      if (e.key === 'Escape') { this.closeAllPopups(li); }
    });

    cancelBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCancel(e); }
      if (e.key === 'Escape') { this.closeAllPopups(li); }
    });

    this.positionPopup(popup, button);
    setTimeout(() => textarea.focus(), 0);
    this.currentPopup = popup;

    setTimeout(() => {
      const handleOutsideClick = (e) => {
        const isInsidePopup = popup.contains(e.target);
        const isInOutlineList = e.target.closest('outline-list');
        const isPopupElement = e.target.closest('.outline-popup');
        
        // For shadow DOM: check if the actual clicked element (using composedPath) is inside the popup
        let isInsideShadowPopup = false;
        if (e.composedPath) {
          const path = e.composedPath();
          isInsideShadowPopup = path.some(element => 
            element.nodeType === Node.ELEMENT_NODE && 
            (element.classList?.contains('outline-popup') || popup.contains(element))
          );
        }
        
        if (isInsidePopup || isInOutlineList || isPopupElement || isInsideShadowPopup) return;
        this.closeAllPopups(li);
        document.removeEventListener('click', handleOutsideClick);
      };
      document.addEventListener('click', handleOutsideClick);
      // Store reference to remove listener when popup closes
      popup._outsideClickHandler = handleOutsideClick;
    }, 100);
  }

  addComment(li, commentText) {
    if (!commentText) return;
    
    const textSpan = li.querySelector('.outline-text');
    if (!textSpan) return;
    
    // Create new comment object
    const newComment = {
      id: crypto.randomUUID(),
      text: commentText,
      author: this.getCurrentUser(),
      timestamp: new Date().toISOString()
    };
    
    li.focus();
    this.emit('outline:comment', {
      id: li.dataset.id,
      text: textSpan.textContent,
      comment: newComment
    });
  }

  addWorklogEntry(li, worklogText) {
    if (!worklogText) return;
    
    const textSpan = li.querySelector('.outline-text');
    if (!textSpan) return;
    
    // Create new worklog entry object
    const newEntry = {
      id: crypto.randomUUID(),
      text: worklogText,
      author: this.getCurrentUser(),
      timestamp: new Date().toISOString()
    };
    
    li.focus();
    this.emit('outline:worklog', {
      id: li.dataset.id,
      text: textSpan.textContent,
      worklogEntry: newEntry
    });
  }

  showArchivePopup(li, button) {
    this.closeAllPopups();
    li.classList.add('popup-active');
    this.updateHoverButtonsVisibility(li);

    const popup = document.createElement('div');
    popup.className = 'outline-popup date-popup archive-popup';

    const hasChildren = !!li.querySelector('ul > li');
    const heading = document.createElement('div');
    heading.textContent = hasChildren ? 'Archive this and all nested items?' : 'Archive?';
    popup.appendChild(heading);

    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '0.5rem';
    buttonContainer.style.marginTop = '0.5rem';

    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = 'Archive';
    confirmBtn.className = 'hover-button';
    confirmBtn.style.padding = '0.3rem 0.6rem';
    confirmBtn.style.flex = '1';
    confirmBtn.type = 'button';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.className = 'hover-button';
    cancelBtn.style.padding = '0.3rem 0.6rem';
    cancelBtn.style.flex = '1';
    cancelBtn.type = 'button';

    const handleArchive = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.archiveItem(li);
      this.closeAllPopups();
    };
    const handleCancel = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.closeAllPopups(li);
    };
    confirmBtn.addEventListener('click', handleArchive);
    cancelBtn.addEventListener('click', handleCancel);

    buttonContainer.appendChild(confirmBtn);
    buttonContainer.appendChild(cancelBtn);
    popup.appendChild(buttonContainer);

    confirmBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { this.closeAllPopups(li); }
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleArchive(e); }
      // Allow natural Tab/Shift+Tab to move focus
    });
    cancelBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { this.closeAllPopups(li); }
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCancel(e); }
      // Allow natural Tab/Shift+Tab to move focus
    });

    this.positionPopup(popup, button);
    setTimeout(() => confirmBtn.focus(), 0);
    this.currentPopup = popup;

    setTimeout(() => {
      const handleOutsideClick = (e) => {
        const isInsidePopup = popup.contains(e.target);
        const isInOutlineList = e.target.closest('outline-list');
        const isPopupElement = e.target.closest('.outline-popup');
        
        // For shadow DOM: check if the actual clicked element (using composedPath) is inside the popup
        let isInsideShadowPopup = false;
        if (e.composedPath) {
          const path = e.composedPath();
          isInsideShadowPopup = path.some(element => 
            element.nodeType === Node.ELEMENT_NODE && 
            (element.classList?.contains('outline-popup') || popup.contains(element))
          );
        }
        
        if (isInsidePopup || isInOutlineList || isPopupElement || isInsideShadowPopup) return;
        this.closeAllPopups(li);
        document.removeEventListener('click', handleOutsideClick);
      };
      document.addEventListener('click', handleOutsideClick);
      popup._outsideClickHandler = handleOutsideClick;
    }, 0);
  }

  archiveItem(li) {
    const id = li.dataset.id;
    const textSpan = li.querySelector('.outline-text');
    const detailText = textSpan ? textSpan.textContent : '';
    const parentLi = li.parentNode.closest('li');
    const parentUl = li.parentNode;

    // Find the next element to focus on before archiving the current one
    const nextElement = this.findNextFocusableElement(li);

    li.remove();
    if (parentUl && parentUl.tagName === 'UL') {
      // If parent LI exists, update child count and possibly remove empty ul
      if (parentLi) {
        this.updateChildCount(parentLi);
        const sublist = parentLi.querySelector('ul');
        if (sublist && sublist.children.length === 0) {
          parentLi.classList.remove('has-children');
          sublist.remove();
        }
      }
    }

    // Set focus on the next available element
    if (nextElement) {
      nextElement.focus();
    }

    this.emit('outline:archive', { id, text: detailText });
  }

  findNextFocusableElement(li) {
    // Get all siblings of the current element
    const siblings = this.getSiblings(li);
    const currentIndex = siblings.indexOf(li);

    // Try to find the next sibling
    if (currentIndex < siblings.length - 1) {
      return siblings[currentIndex + 1];
    }

    // If no next sibling, try the previous sibling
    if (currentIndex > 0) {
      return siblings[currentIndex - 1];
    }

    // If no siblings, try to find the parent
    const parentLi = li.parentNode.closest('li');
    if (parentLi) {
      return parentLi;
    }

    // If no parent, try to find any available element in the list
    const allItems = this.getItems();
    if (allItems.length > 1) {
      // Find the first item that's not the one being removed
      return allItems.find(item => item !== li);
    }

    // No other elements available
    return null;
  }

  toggleTag(li, tag, isChecked) {
    const existingTagsSpan = li.querySelector('.outline-tags');
    let currentTags = existingTagsSpan ?
      existingTagsSpan.textContent.trim().split(/\s+/).map(t => t.replace(/^#/, '')) : [];

    if (isChecked && !currentTags.includes(tag)) {
      currentTags.push(tag);
    } else if (!isChecked && currentTags.includes(tag)) {
      currentTags = currentTags.filter(t => t !== tag);
    }

    // Update tags without focusing the todo item (to keep popup focus)
    this.updateTagsWithoutFocus(li, currentTags);
  }

  updateTagsWithoutFocus(li, tags) {
    const textSpan = li.querySelector(".outline-text");
    if (!textSpan) return;

    let tagsSpan = li.querySelector(".outline-tags");
    if (!tagsSpan) {
      tagsSpan = document.createElement("span");
      tagsSpan.className = "outline-tags";
      tagsSpan.style.display = "none"; // Hide the span, show in button
      // Insert after buttons container if it exists, otherwise after text
      const buttonsContainer = li.querySelector(".outline-hover-buttons");
      if (buttonsContainer) {
        buttonsContainer.after(tagsSpan);
      } else {
        textSpan.after(tagsSpan);
      }
    }

    tagsSpan.textContent = tags.length > 0 ? ` ${tags.join(' ')}` : "";

    // Update the hover button to show the data (without focusing)
    this.updateHoverButtons(li);

    // Emit event
    this.emit("outline:tags", {
      id: li.dataset.id,
      text: textSpan.textContent,
      tags: tags
    });
  }

  addNewTag(li, newTag) {
    const existingTagsSpan = li.querySelector('.outline-tags');
    let currentTags = existingTagsSpan ?
      existingTagsSpan.textContent.trim().split(/\s+/).map(t => t.replace(/^#/, '')) : [];

    if (!currentTags.includes(newTag)) {
      currentTags.push(newTag);
      this.updateTagsWithoutFocus(li, currentTags);
    }
  }

  showStatusPopup(li, button) {
    this.closeAllPopups();

    // Add popup-active class to keep metadata visible
    li.classList.add('popup-active');
    this.updateHoverButtonsVisibility(li);

    const popup = document.createElement('div');
    popup.className = 'outline-popup dropdown-popup';

    // Get current status to determine which option should be selected
    const currentLabel = li.querySelector('.outline-label');
    let currentStatus = 'none';

    if (currentLabel && currentLabel.style.display !== 'none') {
      const currentText = currentLabel.textContent.trim();
      const statusIndex = this.options.statusLabels.findIndex(status => status.label === currentText);
      if (statusIndex >= 0) {
        currentStatus = `status-${statusIndex}`;
      }
    }

    // Status options - use custom labels if provided
    const statusOptions = [];

    // Always add "None" option first
    statusOptions.push({
      value: 'none',
      label: 'None',
      description: 'Convert to heading (no label)'
    });

    // Add custom status labels
    this.options.statusLabels.forEach((status, index) => {
      statusOptions.push({
        value: `status-${index}`,
        label: status.label,
        description: `Mark as ${status.label.toLowerCase()}`
      });
    });

    statusOptions.forEach((option, index) => {
      const item = document.createElement('div');
      item.className = 'dropdown-item';
      item.textContent = option.label;
      item.setAttribute('data-value', option.value);
      item.setAttribute('tabindex', '0');

      // Mark current status as selected
      if (option.value === currentStatus) {
        item.classList.add('selected');
      }

      // Handle click
      item.addEventListener('click', () => {
        const success = this.setTodoStatus(li, option.value);
        if (success) {
          this.closeAllPopups();
        }
      });

      // Handle keyboard
      item.addEventListener('keydown', (e) => {
        this.handleDropdownKeydown(e, item, () => {
          const success = this.setTodoStatus(li, option.value);
          if (success) {
            this.closeAllPopups();
          }
        }, li);
      });

      popup.appendChild(item);
    });

    // Position popup relative to the list container
    this.positionPopup(popup, button);

    // Focus the currently selected item, or first item if none selected
    setTimeout(() => {
      const selectedItem = popup.querySelector('.dropdown-item.selected') ||
                          popup.querySelector('.dropdown-item');
      if (selectedItem) selectedItem.focus();
    }, 0);

    // Close on outside click
    setTimeout(() => {
      const handleOutsideClick = (e) => {
        // Don't close if clicking inside the popup, on any popup element, or within the web component
        const isInsidePopup = popup.contains(e.target);
        const isInOutlineList = e.target.closest('outline-list');
        const isPopupElement = e.target.closest('.outline-popup');
        
        // For shadow DOM: check if the actual clicked element (using composedPath) is inside the popup
        let isInsideShadowPopup = false;
        if (e.composedPath) {
          const path = e.composedPath();
          isInsideShadowPopup = path.some(element => 
            element.nodeType === Node.ELEMENT_NODE && 
            (element.classList?.contains('outline-popup') || popup.contains(element))
          );
        }
        
        if (isInsidePopup || isInOutlineList || isPopupElement || isInsideShadowPopup) {
          return;
        }
        
        // Close popup and remove listener
        this.closeAllPopups(li);
        document.removeEventListener('click', handleOutsideClick);
      };

      document.addEventListener('click', handleOutsideClick);
      
      // Store reference to remove listener when popup closes
      popup._outsideClickHandler = handleOutsideClick;
    }, 100);
  }

  setTodoStatus(li, status) {
    const label = li.querySelector(".outline-label");
    if (!label) return false;

    // Check if we can complete this parent
    if (!this.canCompleteParent(li, status)) {
      this.showPermissionDeniedFeedback(li, 'complete-with-incomplete-children');
      return false;
    }

    // Remove existing state classes
    li.classList.remove("completed", "no-label");

    // Apply new state
    if (status === 'none') {
      li.classList.add("no-label");
      label.style.display = "none";
    } else if (status.startsWith('status-')) {
      // Custom status label
      const index = parseInt(status.split('-')[1]);
      const customLabel = this.options.statusLabels[index];
      if (customLabel) {
        label.style.display = "";
        label.textContent = customLabel.label;

        // Check if this should be treated as "completed" (last status is typically completed)
        if (customLabel.isEndState) {
          li.classList.add("completed");
        }
      }
    } else {
      // Fallback to first status label
      const firstLabel = this.options.statusLabels[0].label;
      label.style.display = "";
      label.textContent = firstLabel;
    }

    // Update hover buttons
    this.updateHoverButtons(li);

    // Update parent counters
    let parentLi = li.parentNode.closest("li");
    while(parentLi) {
      this.updateChildCount(parentLi);
      parentLi = parentLi.parentNode.closest("li");
    }

    // Restore focus to the todo item
    li.focus();

    this.emit("outline:toggle", {
      id: li.dataset.id,
      to: status,
      completed: li.classList.contains("completed"),
      hasLabel: !li.classList.contains("no-label")
    });
    
    return true;
  }

  setTags(li, tags) {
    const textSpan = li.querySelector(".outline-text");
    if (!textSpan) return;

    let tagsSpan = li.querySelector(".outline-tags");
    if (!tagsSpan) {
      tagsSpan = document.createElement("span");
      tagsSpan.className = "outline-tags";
      tagsSpan.style.display = "none"; // Hide the span, show in button
      // Insert after buttons container if it exists, otherwise after text
      const buttonsContainer = li.querySelector(".outline-hover-buttons");
      if (buttonsContainer) {
        buttonsContainer.after(tagsSpan);
      } else {
        textSpan.after(tagsSpan);
      }
    }

    tagsSpan.textContent = tags.length > 0 ? ` ${tags.join(' ')}` : "";

    // Update the hover button to show the data
    this.updateHoverButtons(li);

    // Restore focus to the todo item
    li.focus();

    this.emit("outline:tags", {
      id: li.dataset.id,
      text: textSpan.textContent,
      tags: tags
    });
  }

  togglePriority(li) {
    const textSpan = li.querySelector(".outline-text");
    if (!textSpan) return;

    // Check if already has priority
    const isPriority = li.classList.contains("priority");

    if (isPriority) {
      // Remove priority
      li.classList.remove("priority");
      const prioritySpan = li.querySelector(".outline-priority");
      if (prioritySpan) {
        prioritySpan.remove();
      }
    } else {
      // Add priority
      li.classList.add("priority");

      // Create hidden priority span (like other metadata)
      let prioritySpan = li.querySelector(".outline-priority");
      if (!prioritySpan) {
        prioritySpan = document.createElement("span");
        prioritySpan.className = "outline-priority";
        prioritySpan.style.display = "none"; // Hide the span, show in button
        // Insert after buttons container if it exists, otherwise after text
        const buttonsContainer = li.querySelector(".outline-hover-buttons");
        if (buttonsContainer) {
          buttonsContainer.after(prioritySpan);
        } else {
          textSpan.after(prioritySpan);
        }
      }
      prioritySpan.textContent = " priority";
    }

    // Update the hover button to show the data
    this.updateHoverButtons(li);

    // Restore focus to the todo item
    li.focus();

    this.emit("outline:priority", {
      id: li.dataset.id,
      text: textSpan.textContent,
      priority: !isPriority
    });
  }

  toggleBlocked(li) {
    const textSpan = li.querySelector(".outline-text");
    if (!textSpan) return;

    // Check if already blocked
    const isBlocked = li.classList.contains("blocked");

    if (isBlocked) {
      // Remove blocked
      li.classList.remove("blocked");
      const blockedSpan = li.querySelector(".outline-blocked");
      if (blockedSpan) {
        blockedSpan.remove();
      }
    } else {
      // Add blocked
      li.classList.add("blocked");

      // Create hidden blocked span (like other metadata)
      let blockedSpan = li.querySelector(".outline-blocked");
      if (!blockedSpan) {
        blockedSpan = document.createElement("span");
        blockedSpan.className = "outline-blocked";
        blockedSpan.style.display = "none"; // Hide the span, show in button
        // Insert after buttons container if it exists, otherwise after text
        const buttonsContainer = li.querySelector(".outline-hover-buttons");
        if (buttonsContainer) {
          buttonsContainer.after(blockedSpan);
        } else {
          textSpan.after(blockedSpan);
        }
      }
      blockedSpan.textContent = " blocked";
    }

    // Update the hover button to show the data
    this.updateHoverButtons(li);

    // Restore focus to the todo item
    li.focus();

    this.emit("outline:blocked", {
      id: li.dataset.id,
      text: textSpan.textContent,
      blocked: !isBlocked
    });
  }

  emit(name,detail){ this.el.dispatchEvent(new CustomEvent(name,{detail})); }

  // Static helper methods for creating constrained outlines
  static createSingleItemOutline(container, options = {}) {
    // Create a ul element for the single item
    const ul = document.createElement('ul');
    ul.className = 'outline-list';
    container.appendChild(ul);
    
    // Configure for single item use (disable navigation and add button)
    const constrainedOptions = {
      features: {
        // Keep task-specific features
        priority: true,
        blocked: true,
        due: true,
        schedule: true,
        assign: true,
        tags: true,
        comments: true,
        worklog: true,
        archive: true,
        // Disable outline-specific features
        addButton: false,
        navigation: false,
        reorder: false,
        ...options.features // Allow overrides
      },
      ...options
    };
    
    return new Outline(ul, constrainedOptions);
  }

  static createAgendaItemOutline(container, options = {}) {
    // Create a ul element for the agenda item
    const ul = document.createElement('ul');
    ul.className = 'outline-list';
    container.appendChild(ul);
    
    // Configure for agenda use (allow some interaction but no navigation)
    const agendaOptions = {
      features: {
        // Keep task-specific features
        priority: true,
        blocked: true,
        due: true,
        schedule: true,
        assign: true,
        tags: true,
        comments: true,
        worklog: true,
        archive: false, // Usually don't want to archive from agenda
        // Disable outline-specific features
        addButton: false,
        navigation: false,
        reorder: false,
        ...options.features // Allow overrides
      },
      ...options
    };
    
    return new Outline(ul, agendaOptions);
  }

  // Drag and Drop functionality
  async initDragAndDrop() {
    try {
      // Dynamically load sortable.js if not already loaded
      if (typeof Sortable === 'undefined') {
        await this.loadSortableJS();
      }

      // Drag handles are no longer needed - entire items are draggable

      // Initialize sortable on all lists (main and nested)
      this.initSortableOnAllLists();

    } catch (error) {
      console.error('Failed to initialize drag and drop:', error);
    }
  }

  initSortableOnAllLists() {
    // Skip if Sortable is not available
    if (typeof Sortable === 'undefined') {
      return;
    }

    // Store all sortable instances for cleanup
    this.sortableInstances = this.sortableInstances || [];

    // Find all ul elements (main list and nested sublists)
    const allLists = [this.el, ...this.el.querySelectorAll('ul')];
    
    allLists.forEach(listEl => {
      // Skip if already initialized
      if (listEl._sortableInstance) {
        return;
      }

      const sortableInstance = Sortable.create(listEl, {
        group: 'outline-items', // Allow dragging between lists
        animation: 150,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        dragClass: 'sortable-drag',
        fallbackOnBody: true,
        swapThreshold: 0.65,
        onEnd: (evt) => {
          this.handleHierarchicalDragEnd(evt);
        },
        onMove: (evt) => {
          return this.handleDragMove(evt);
        }
      });

      // Store reference for cleanup
      listEl._sortableInstance = sortableInstance;
      this.sortableInstances.push(sortableInstance);
    });
  }

  async loadSortableJS() {
    return new Promise((resolve, reject) => {
      // Check if already loaded
      if (typeof Sortable !== 'undefined') {
        resolve();
        return;
      }

      // Create script element
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load SortableJS'));
      
      // Add to document head
      document.head.appendChild(script);
    });
  }

  // Drag handles are no longer needed - entire items are draggable

  handleDragMove(evt) {
    const { dragged, related, relatedRect, willInsertAfter } = evt;
    
    // Allow all moves for now - we'll handle the logic in onEnd
    return true;
  }

  handleHierarchicalDragEnd(evt) {
    const { item, from, to, oldIndex, newIndex } = evt;
    
    // Skip if no actual movement
    if (from === to && oldIndex === newIndex) {
      return;
    }

    // Determine the type of move
    let moveType = 'reorder';
    let parentId = null;
    
    // Check if item moved to a different list (nesting change)
    if (from !== to) {
      // Find the parent li of the destination list
      const parentLi = to.closest('li');
      if (parentLi) {
        moveType = 'indent';
        parentId = parentLi.dataset.id;
      } else {
        moveType = 'outdent';
      }
    }

    // Update child counts for affected parents
    this.updateChildCountsAfterMove(from, to);

    // Emit move event with hierarchical information
    const moveEvent = new CustomEvent('outline:move', {
      detail: {
        item: item,
        oldIndex: oldIndex,
        newIndex: newIndex,
        moveType: moveType,
        parentId: parentId,
        fromList: from,
        toList: to,
        direction: newIndex > oldIndex ? 'down' : 'up'
      },
      bubbles: true
    });
    
    this.el.dispatchEvent(moveEvent);
  }

  updateChildCountsAfterMove(fromList, toList) {
    // Update child count for the source parent
    if (fromList && fromList.closest) {
      const fromParentLi = fromList.closest('li');
      if (fromParentLi) {
        this.updateChildCount(fromParentLi);
        
        // Remove empty sublists
        if (fromList.children.length === 0 && fromList !== this.el) {
          fromParentLi.classList.remove('has-children');
          fromList.remove();
        }
      }
    }

    // Update child count for the destination parent
    if (toList && toList.closest) {
      const toParentLi = toList.closest('li');
      if (toParentLi) {
        toParentLi.classList.add('has-children');
        this.updateChildCount(toParentLi);
      }
    }
  }

  // Clean up drag and drop
  destroyDragAndDrop() {
    // Clean up all sortable instances
    if (this.sortableInstances) {
      this.sortableInstances.forEach(instance => {
        instance.destroy();
      });
      this.sortableInstances = [];
    }

    // Clean up old single instance if it exists
    if (this.sortableInstance) {
      this.sortableInstance.destroy();
      this.sortableInstance = null;
    }

    // Remove sortable instance references from DOM elements
    [this.el, ...this.el.querySelectorAll('ul')].forEach(listEl => {
      if (listEl._sortableInstance) {
        delete listEl._sortableInstance;
      }
    });

    // Drag handles are no longer used
  }

  // Method to reinitialize sortable on new sublists
  initSortableOnNewSublist(sublist) {
    if (!this.options.features.dragAndDrop || sublist._sortableInstance || typeof Sortable === 'undefined') {
      return;
    }

    const sortableInstance = Sortable.create(sublist, {
      group: 'outline-items',
      animation: 150,
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      dragClass: 'sortable-drag',
      fallbackOnBody: true,
      swapThreshold: 0.65,
      onEnd: (evt) => {
        this.handleHierarchicalDragEnd(evt);
      },
      onMove: (evt) => {
        return this.handleDragMove(evt);
      }
    });

    sublist._sortableInstance = sortableInstance;
    this.sortableInstances = this.sortableInstances || [];
    this.sortableInstances.push(sortableInstance);
  }
}

// Helper class for creating and managing task item buttons
class TaskItemButtons {
  constructor(outlineInstance, li, features) {
    this.outline = outlineInstance;
    this.li = li;
    this.features = features;
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
      if (!this.outline.isItemEditable(this.li)) {
        this.outline.showPermissionDeniedFeedback(this.li);
        return;
      }
      this.outline.togglePriority(this.li);
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
      if (!this.outline.isItemEditable(this.li)) {
        this.outline.showPermissionDeniedFeedback(this.li);
        return;
      }
      this.outline.toggleBlocked(this.li);
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
      if (!this.outline.isItemEditable(this.li)) {
        this.outline.showPermissionDeniedFeedback(this.li);
        return;
      }
      this.outline.showDuePopup(this.li, dueBtn);
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
      if (!this.outline.isItemEditable(this.li)) {
        this.outline.showPermissionDeniedFeedback(this.li);
        return;
      }
      this.outline.showSchedulePopup(this.li, scheduleBtn);
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
      if (!this.outline.isItemEditable(this.li)) {
        this.outline.showPermissionDeniedFeedback(this.li);
        return;
      }
      this.outline.showAssignPopup(this.li, assignBtn);
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
      if (!this.outline.isItemEditable(this.li)) {
        this.outline.showPermissionDeniedFeedback(this.li);
        return;
      }
      this.outline.showTagsPopup(this.li, tagsBtn);
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
      this.outline.showCommentsPopup(this.li, commentsBtn);
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
      this.outline.showWorklogPopup(this.li, worklogBtn);
    });
    container.appendChild(worklogBtn);
  }

  createArchiveButton(container) {
    if (!this.features.archive) return;

    const archiveBtn = document.createElement("button");
    archiveBtn.className = "hover-button archive-button";
    archiveBtn.setAttribute("data-type", "archive");
    archiveBtn.tabIndex = -1;
    archiveBtn.innerHTML = "a<u>r</u>chive";
    archiveBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!this.outline.isItemEditable(this.li)) {
        this.outline.showPermissionDeniedFeedback(this.li);
        return;
      }
      this.outline.showArchivePopup(this.li, archiveBtn);
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
      if (!this.outline.isItemEditable(this.li)) {
        this.outline.showPermissionDeniedFeedback(this.li);
        return;
      }
      this.outline.enterEditMode(this.li);
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
      this.outline.openItem(this.li);
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

// TaskItem class - wraps <li> elements with task-specific behavior
class TaskItem {
  constructor(li, outlineInstance) {
    this.li = li;
    this.outline = outlineInstance;
    this.buttonManager = null;
    
    // Initialize if this is a new task item
    if (!li.dataset.taskItemInitialized) {
      this.initialize();
    }
  }

  initialize() {
    // Mark as initialized to prevent double initialization
    this.li.dataset.taskItemInitialized = 'true';
    
    // Set up basic properties
    this.li.tabIndex = 0;
    
    // Add hover buttons using our TaskItemButtons helper
    this.addButtons();
    
    // Set up status label click handler
    this.setupStatusLabelHandler();
  }

  addButtons() {
    this.buttonManager = new TaskItemButtons(this.outline, this.li, this.outline.options.features);
    const buttonsContainer = this.buttonManager.createButtonsContainer();
    
    if (!buttonsContainer) return; // Buttons already exist
    
    // Insert buttons in the correct position
    this.insertButtonsContainer(buttonsContainer);
    
    // Set up hover behavior
    this.outline.addHoverDelayHandlers(this.li, buttonsContainer);
    
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
        this.outline.showStatusPopup(this.li, statusLabel);
      });
      statusLabel.dataset.handlerAdded = 'true';
    }
  }

  // Delegate key methods to outline instance for now
  // (In future steps, we can move more logic into this class)
  
  isEditable() {
    return this.outline.isItemEditable(this.li);
  }

  showPermissionDeniedFeedback() {
    return this.outline.showPermissionDeniedFeedback(this.li);
  }

  enterEditMode() {
    return this.outline.enterEditMode(this.li);
  }

  togglePriority() {
    return this.outline.togglePriority(this.li);
  }

  toggleBlocked() {
    return this.outline.toggleBlocked(this.li);
  }

  updateButtons() {
    return this.outline.updateHoverButtons(this.li);
  }

  updateChildCount() {
    return this.outline.updateChildCount(this.li);
  }

  updateButtonsVisibility() {
    return this.outline.updateHoverButtonsVisibility(this.li);
  }

  // Getters for common properties
  get id() {
    return this.li.dataset.id;
  }

  get text() {
    const textSpan = this.li.querySelector(".outline-text");
    return textSpan ? textSpan.textContent : '';
  }

  get status() {
    const labelSpan = this.li.querySelector(".outline-label");
    return labelSpan ? labelSpan.textContent : 'TODO';
  }

  // Static method to create a TaskItem from an existing li element
  static fromElement(li, outlineInstance) {
    return new TaskItem(li, outlineInstance);
  }

  // Static method to create a new TaskItem with basic structure
  static create(outlineInstance, text = "New todo", status = "TODO") {
    const li = document.createElement("li");
    li.tabIndex = 0;
    li.dataset.id = crypto.randomUUID();

    // Create the label span
    const labelSpan = document.createElement("span");
    labelSpan.className = "outline-label";
    labelSpan.textContent = status;

    // Create the text span
    const textSpan = document.createElement("span");
    textSpan.className = "outline-text";
    textSpan.textContent = text;

    // Assemble the structure
    li.appendChild(labelSpan);
    li.appendChild(document.createTextNode(" "));
    li.appendChild(textSpan);

    // Create TaskItem instance
    const taskItem = new TaskItem(li, outlineInstance);

    // Drag handles are no longer needed - entire items are draggable

    // Return the TaskItem instance
    return taskItem;
  }
}

// Web Component Wrapper
class OutlineElement extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.todoList = null;
  }

  connectedCallback() {
    // Parse options from attributes
    const options = this.parseOptions();

    // Create the list element
    const listEl = document.createElement('ul');
    listEl.className = 'outline-list';

    // Parse todos from data attribute or children
    const todos = this.parseTodos();

    // Render todos into the list
    this.renderTodos(listEl, todos, options);

    // Add the list to shadow DOM
    this.shadowRoot.appendChild(listEl);

    // Add CSS
    this.addStyles();

    // Initialize the Outline
    this.todoList = new Outline(listEl, options);

    // Forward events from shadow DOM to light DOM
    this.forwardEvents();

    // Apply initial theme from attribute if set
    const initialTheme = this.getAttribute('theme');
    if (initialTheme) {
      this.applyTheme(initialTheme);
    } else {
      // Apply theme from parent document if no theme attribute
      this.applyThemeFromParent();
    }

    // Listen for theme changes
    this.setupThemeListener();
  }

  disconnectedCallback() {
    // Clean up if needed
    if (this.todoList) {
      // Remove event listeners if the Outline class has a destroy method
      if (typeof this.todoList.destroy === 'function') {
        this.todoList.destroy();
      }
    }

    // Clean up any add button
    const existingAddButton = this.shadowRoot.querySelector('.outline-add-button');
    if (existingAddButton) {
      existingAddButton.remove();
    }
  }

  parseOptions() {
    const options = {};

    // Parse options from data-* attributes
    const assignees = this.getAttribute('data-assignees');
    if (assignees) {
      try {
        options.assignees = JSON.parse(assignees);
      } catch (e) {
        options.assignees = assignees.split(',').map(s => s.trim());
      }
    }

    const tags = this.getAttribute('data-tags');
    if (tags) {
      try {
        options.tags = JSON.parse(tags);
      } catch (e) {
        options.tags = tags.split(',').map(s => s.trim());
      }
    }

    const statusLabels = this.getAttribute('data-status-labels');
    if (statusLabels) {
      try {
        options.statusLabels = JSON.parse(statusLabels);
      } catch (e) {
        console.warn('Invalid status-labels format, using default');
      }
    }

    // Parse current user from data-current-user attribute
    const currentUser = this.getAttribute('data-current-user');
    if (currentUser) {
      options.currentUser = currentUser;
    }

    // Parse feature options from data-features attribute
    const features = this.getAttribute('data-features');
    if (features) {
      try {
        options.features = JSON.parse(features);
      } catch (e) {
        console.warn('Invalid features format, using default');
      }
    }


    return options;
  }

  parseTodos() {
    // First try to get todos from data-items attribute
    const todosData = this.getAttribute('data-items');
    if (todosData) {
      try {
        return JSON.parse(todosData);
      } catch (e) {
        console.warn('Invalid todos JSON, falling back to children');
      }
    }

    // Fallback: parse from existing children (backward compatibility)
    return this.parseTodosFromChildren();
  }

  parseTodosFromChildren() {
    const todos = [];

    // Convert existing li elements to todo objects
    this.querySelectorAll('li').forEach(li => {
      const todo = this.liToTodoObject(li);
      todos.push(todo);
    });

    return todos;
  }

  liToTodoObject(li) {
    const todo = {
      id: li.dataset.id || crypto.randomUUID(),
      text: li.querySelector('.outline-text')?.textContent || '',
      status: li.querySelector('.outline-label')?.textContent || 'TODO',
      classes: Array.from(li.classList).join(' '),
      editable: li.dataset.editable !== 'false' // Default to true if not specified
    };

    // Parse metadata
    const schedule = li.querySelector('.outline-schedule');
    if (schedule) {
      todo.schedule = schedule.textContent.trim();
    }

    const assign = li.querySelector('.outline-assign');
    if (assign) {
      todo.assign = assign.textContent.trim();
    }

    const tags = li.querySelector('.outline-tags');
    if (tags) {
      todo.tags = tags.textContent.trim().split(/\s+/).filter(tag => tag.length > 0);
    }

    const priority = li.querySelector('.outline-priority');
    if (priority) {
      todo.priority = true;
    }

          const blocked = li.querySelector('.outline-blocked');
      if (blocked) {
        todo.blocked = true;
      }


    // Handle nested todos
    const sublist = li.querySelector('ul');
    if (sublist) {
      todo.children = [];
      sublist.querySelectorAll('li').forEach(childLi => {
        todo.children.push(this.liToTodoObject(childLi));
      });
    }

    return todo;
  }

  renderTodos(listEl, todos, options) {
    todos.forEach(todo => {
      const li = this.createTodoElement(todo, options);
      listEl.appendChild(li);
    });
  }

  createTodoElement(todo, options) {
    const li = document.createElement('li');
    li.dataset.id = todo.id;
    li.tabIndex = 0;
    
    // Set editable attribute (default to true if not specified)
    li.dataset.editable = todo.editable !== false ? 'true' : 'false';

    // Add classes
    if (todo.classes) {
      li.className = todo.classes;
    }

    // Add status classes based on todo state
    if (todo.status === 'DONE' || todo.completed) {
      li.classList.add('completed');
    } else if (todo.status && options && options.statusLabels) {
      // Check if this is a custom status label that should be treated as completed
      const statusLabel = options.statusLabels.find(label => label.label === todo.status);
      if (statusLabel && statusLabel.isEndState) {
        li.classList.add('completed');
      }
    }
    if (todo.status === 'none' || todo.noLabel) {
      li.classList.add('no-label');
    }
    if (todo.priority) {
      li.classList.add('priority');
    }
    if (todo.blocked) {
      li.classList.add('blocked');
    }
    if (todo.children && todo.children.length > 0) {
      li.classList.add('has-children');
    }

    // Create label span
    const labelSpan = document.createElement('span');
    labelSpan.className = 'outline-label';
    labelSpan.textContent = todo.status || 'TODO';
    if (todo.status === 'none' || todo.noLabel) {
      labelSpan.style.display = 'none';
    }
    li.appendChild(labelSpan);

    // Add space
    li.appendChild(document.createTextNode(' '));

    // Create text span
    const textSpan = document.createElement('span');
    textSpan.className = 'outline-text';
    textSpan.textContent = todo.text;
    li.appendChild(textSpan);

    // Add child count if needed
    if (todo.children && todo.children.length > 0) {
      const completedCount = todo.children.filter(child =>
        child.status === 'DONE' || child.completed
      ).length;
      const countSpan = document.createElement('span');
      countSpan.className = 'child-count';
      Outline.createProgressBar(countSpan, completedCount, todo.children.length);
      li.appendChild(countSpan);
    }

    // Add metadata spans (hidden)
    if (todo.schedule) {
      const scheduleSpan = document.createElement('span');
      scheduleSpan.className = 'outline-schedule';
      scheduleSpan.style.display = 'none';
      scheduleSpan.textContent = ` ${todo.schedule}`;
      li.appendChild(scheduleSpan);
    }

    if (todo.assign) {
      const assignSpan = document.createElement('span');
      assignSpan.className = 'outline-assign';
      assignSpan.style.display = 'none';
      assignSpan.textContent = ` ${todo.assign}`;
      li.appendChild(assignSpan);
    }

    if (todo.tags && todo.tags.length > 0) {
      const tagsSpan = document.createElement('span');
      tagsSpan.className = 'outline-tags';
      tagsSpan.style.display = 'none';
      tagsSpan.textContent = ` ${todo.tags.join(' ')}`;
      li.appendChild(tagsSpan);
    }

    if (todo.priority) {
      const prioritySpan = document.createElement('span');
      prioritySpan.className = 'outline-priority';
      prioritySpan.style.display = 'none';
      prioritySpan.textContent = ' priority';
      li.appendChild(prioritySpan);
    }

    if (todo.blocked) {
      const blockedSpan = document.createElement('span');
      blockedSpan.className = 'outline-blocked';
      blockedSpan.style.display = 'none';
      blockedSpan.textContent = ' blocked';
      li.appendChild(blockedSpan);
    }

    // Handle nested todos
    if (todo.children && todo.children.length > 0) {
      const sublist = document.createElement('ul');
      todo.children.forEach(childTodo => {
        const childLi = this.createTodoElement(childTodo, options);
        sublist.appendChild(childLi);
      });
      li.appendChild(sublist);
    }

    return li;
  }

  // Public method to update todos from JavaScript
  setTodos(todos) {
    if (!this.todoList) return;

    const listEl = this.shadowRoot.querySelector('.outline-list');
    listEl.innerHTML = '';
    this.renderTodos(listEl, todos);

    // Clean up any existing add button before reinitializing
    const existingAddButton = this.shadowRoot.querySelector('.outline-add-button');
    if (existingAddButton) {
      existingAddButton.remove();
    }

    // Reinitialize the Outline with new content
    const options = this.parseOptions();
    this.todoList = new Outline(listEl, options);
    this.forwardEvents();
  }

  // Public method to get current todos as JSON
  getTodos() {
    if (!this.todoList) return [];

    const listEl = this.shadowRoot.querySelector('.outline-list');
    const todos = [];

    listEl.querySelectorAll('li').forEach(li => {
      todos.push(this.liToTodoObject(li));
    });

    return todos;
  }

  // Method to handle attribute changes (for Datastar integration)
  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'data-items' && oldValue !== newValue) {
      // Re-render when data-items attribute changes
      this.rerenderFromAttribute();
    } else if (name === 'theme' && oldValue !== newValue) {
      // Handle theme changes
      this.applyTheme(newValue);
    }
  }

  // Static getter for observed attributes
  static get observedAttributes() {
    return ['data-items', 'theme'];
  }

  // Re-render the component when data-items attribute changes
  rerenderFromAttribute() {
    if (!this.todoList) return;

    const todos = this.parseTodos();
    this.setTodos(todos);
  }

  addStyles() {
    // Add the CSS directly to the shadow DOM to ensure it's always available
    const style = document.createElement('style');
    style.textContent = `
              /* CSS Custom Properties for Theming */
        :host {
          display: block;
          font-family: monospace;
          width: 100%;
          /* Light theme colors */
          --clarity-outline-light-bg-primary: #ffffff;
          --clarity-outline-light-bg-secondary: #f8f9fa;
          --clarity-outline-light-bg-tertiary: #e9ecef;
          --clarity-outline-light-text-primary: #212529;
          --clarity-outline-light-text-secondary: #6c757d;
          --clarity-outline-light-text-muted: #adb5bd;
          --clarity-outline-light-border: #dee2e6;
          --clarity-outline-light-border-focus: #8a9ba8;
          --clarity-outline-light-hover: rgba(0, 0, 0, 0.05);
          --clarity-outline-light-focus: rgba(0, 0, 0, 0.1);
          --clarity-outline-light-focus-shadow: rgba(138, 155, 168, 0.3);
          --clarity-outline-light-focus-highlight: rgba(138, 155, 168, 0.15);
          --clarity-outline-light-input-bg: #ffffff;
          --clarity-outline-light-input-border: #e1e5e9;
          --clarity-outline-light-popup-bg: #ffffff;
          --clarity-outline-light-popup-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);

          /* Dark theme colors */
          --clarity-outline-dark-bg-primary: #1e1e1e;
          --clarity-outline-dark-bg-secondary: #2d2d2d;
          --clarity-outline-dark-bg-tertiary: #333333;
          --clarity-outline-dark-text-primary: #f8f8f2;
          --clarity-outline-dark-text-secondary: #ddd;
          --clarity-outline-dark-text-muted: #888;
          --clarity-outline-dark-border: #555;
          --clarity-outline-dark-border-focus: #b8c5d1;
          --clarity-outline-dark-hover: rgba(255, 255, 255, 0.08);
          --clarity-outline-dark-focus: rgba(255, 255, 255, 0.15);
          --clarity-outline-dark-focus-shadow: rgba(184, 197, 209, 0.4);
          --clarity-outline-dark-focus-highlight: rgba(184, 197, 209, 0.35);
          --clarity-outline-dark-input-bg: #2d2d2d;
          --clarity-outline-dark-input-border: #999;
          --clarity-outline-dark-popup-bg: #2d2d2d;
          --clarity-outline-dark-popup-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);

          /* Semantic colors */
          --clarity-outline-color-todo: #d16d7a;
          --clarity-outline-color-done: #6c757d;
          --clarity-outline-color-priority: #5f9fb0;
          --clarity-outline-color-blocked: #f39c12;

          /* Active theme variables - default to dark theme */
          --clarity-outline-bg-primary: var(--clarity-outline-dark-bg-primary);
          --clarity-outline-bg-secondary: var(--clarity-outline-dark-bg-secondary);
          --clarity-outline-bg-tertiary: var(--clarity-outline-dark-bg-tertiary);
          --clarity-outline-text-primary: var(--clarity-outline-dark-text-primary);
          --clarity-outline-text-secondary: var(--clarity-outline-dark-text-secondary);
          --clarity-outline-text-muted: var(--clarity-outline-dark-text-muted);
          --clarity-outline-border: var(--clarity-outline-dark-border);
          --clarity-outline-border-focus: var(--clarity-outline-dark-border-focus);
          --clarity-outline-hover: var(--clarity-outline-dark-hover);
          --clarity-outline-focus: var(--clarity-outline-dark-focus);
          --clarity-outline-focus-shadow: var(--clarity-outline-dark-focus-shadow);
          --clarity-outline-focus-highlight: var(--clarity-outline-dark-focus-highlight);
          --clarity-outline-input-bg: var(--clarity-outline-dark-input-bg);
          --clarity-outline-input-border: var(--clarity-outline-dark-input-border);
          --clarity-outline-popup-bg: var(--clarity-outline-dark-popup-bg);
          --clarity-outline-popup-shadow: var(--clarity-outline-dark-popup-shadow);

          /* Component-level customization properties */
          --clarity-outline-spacing: 0.3rem;
          --clarity-outline-padding: 0.5rem;
          --clarity-outline-border-radius: 0;
          --clarity-outline-font-size: inherit;
          --clarity-outline-font-family: inherit;
          --clarity-outline-line-height: 1.5;
          --clarity-outline-transition-duration: 0.15s;
          --clarity-outline-nested-indent: 0.75rem;
          --clarity-outline-nested-border-width: 1px;
          --clarity-outline-nested-border-style: dotted;
          --clarity-outline-popup-min-width: 200px;
          --clarity-outline-popup-border-radius: 4px;
          --clarity-outline-popup-padding: 0.5rem;
          --clarity-outline-input-border-radius: 2px;
          --clarity-outline-input-padding: 0.2rem 0.4rem;
        }

        /* Light theme support via media query */
        @media (prefers-color-scheme: light) {
          :host {
            /* Switch to light theme */
            --clarity-outline-bg-primary: var(--clarity-outline-light-bg-primary);
            --clarity-outline-bg-secondary: var(--clarity-outline-light-bg-secondary);
            --clarity-outline-bg-tertiary: var(--clarity-outline-light-bg-tertiary);
            --clarity-outline-text-primary: var(--clarity-outline-light-text-primary);
            --clarity-outline-text-secondary: var(--clarity-outline-light-text-secondary);
            --clarity-outline-text-muted: var(--clarity-outline-light-text-muted);
            --clarity-outline-border: var(--clarity-outline-light-border);
            --clarity-outline-border-focus: var(--clarity-outline-light-border-focus);
            --clarity-outline-hover: var(--clarity-outline-light-hover);
            --clarity-outline-focus: var(--clarity-outline-light-focus);
            --clarity-outline-focus-shadow: var(--clarity-outline-light-focus-shadow);
            --clarity-outline-focus-highlight: var(--clarity-outline-light-focus-highlight);
            --clarity-outline-input-bg: var(--clarity-outline-light-input-bg);
            --clarity-outline-input-border: var(--clarity-outline-light-input-border);
            --clarity-outline-popup-bg: var(--clarity-outline-light-popup-bg);
            --clarity-outline-popup-shadow: var(--clarity-outline-light-popup-shadow);
          }
        }

      /* Add todo button styling */
      .outline-add-button {
        display: block;
        margin: 0;
        background: none;
        border: none;
        color: var(--clarity-outline-text-secondary);
        cursor: pointer;
        font-family: inherit;
        font-size: 0.9em;
        padding: 0.5rem 0 0.5rem 0.5rem;
        width: 100%;
        text-align: left;
        border-radius: var(--clarity-outline-border-radius);
        transition: all var(--clarity-outline-transition-duration) ease;
        max-width: 100%;
        overflow: hidden;
      }

      /* Mobile-friendly add button */
      @media (max-width: 768px) {
        .outline-add-button {
          padding: 0.4rem 0 0.4rem 0.4rem;
          font-size: 0.85em;
        }
      }

      .outline-add-button:hover {
        color: var(--clarity-outline-text-primary);
        background: var(--clarity-outline-hover);
      }

      .outline-add-button:focus {
        outline: none;
        color: var(--clarity-outline-text-primary);
        background: var(--clarity-outline-focus);
      }

      /* Todo List Package Styles - Scoped to .outline-list */
      .outline-list {
        /* Base list styling */
        list-style: none;
        padding-left: 0;
        margin: 0;
        margin-block-start: 0;
        margin-block-end: 0;
        font-family: var(--clarity-outline-font-family);
        font-size: var(--clarity-outline-font-size);
        max-width: 100%;
        overflow: visible;

        /* Nested list styling */
        ul {
          margin: 0;
          padding-left: var(--clarity-outline-nested-indent);
          border-left: var(--clarity-outline-nested-border-width) var(--clarity-outline-nested-border-style) var(--clarity-outline-border);
          list-style: none;
          width: 100%;

          li:first-child {
            margin-top: var(--clarity-outline-spacing);
          }
        }

        /* Mobile-friendly nested list adjustments */
        @media (max-width: 768px) {
          ul {
            padding-left: calc(var(--clarity-outline-nested-indent) * 0.75);
          }
        }

        /* List item styling */
        li {
          cursor: pointer;
          line-height: var(--clarity-outline-line-height);
          padding: var(--clarity-outline-spacing) var(--clarity-outline-padding);
          position: relative;
          transition: background-color var(--clarity-outline-transition-duration) ease;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.25rem;

          &:not(:has(> ul li:hover)):hover {
            background: var(--clarity-outline-hover);
          }

          &:focus {
            background: var(--clarity-outline-focus);
            outline: none;
          }

          &.completed {
            > .outline-label {
              color: var(--clarity-outline-color-done);
            }

            > .outline-text {
              color: var(--clarity-outline-color-done);
              text-decoration: line-through;
            }
          }

          &.no-label {
            > .outline-text {
              color: var(--clarity-outline-text-primary);
            }
          }

          &.collapsed::after {
            content: " ▾";
          }

          &.editing {
            display: flex;
            align-items: center;
            gap: 0;
          }

          &.editing > ul {
            display: none !important;
          }
        }

        /* Drag and Drop / Sortable styles */
        .sortable-ghost {
          opacity: 0.4;
          background: var(--clarity-outline-hover);
        }

        .sortable-chosen {
          background: var(--clarity-outline-focus);
        }

        .sortable-drag {
          opacity: 0.8;
          transform: rotate(5deg);
        }

        /* Drop zone indicators */
        li.drop-target {
          background: var(--clarity-outline-focus-highlight, rgba(138, 155, 168, 0.15));
          border: 2px dashed var(--clarity-outline-border-focus, #8a9ba8);
          border-radius: 4px;
        }

        ul.drop-zone {
          background: var(--clarity-outline-focus-highlight, rgba(138, 155, 168, 0.1));
          border: 1px dashed var(--clarity-outline-border-focus, #8a9ba8);
          border-radius: 4px;
          min-height: 2rem;
        }

        /* Draggable items styling - only when drag and drop is enabled */
        :host([data-features*="dragAndDrop"]) li {
          cursor: move;
        }
        
        :host([data-features*="dragAndDrop"]) li:active {
          cursor: grabbing;
        }

        /* Label and text inline */
        .outline-label {
          font-weight: bold;
          color: var(--clarity-outline-color-todo);
          user-select: none;
          margin-right: 0.3rem;
        }

        .outline-text {
          display: inline-block;
        }

        .child-count {
          font-size: 0.85em;
          color: var(--clarity-outline-text-muted);
          margin-left: 0.5rem;
          user-select: none;
        }

        .progress-container {
          display: inline-block;
          margin-left: 0.15rem;
          vertical-align: middle;
        }

        .progress-bar {
          width: 40px;
          height: 12px;
          background-color: var(--clarity-outline-bg-tertiary);
          border-radius: 1px;
          overflow: hidden;
          position: relative;
        }

        .progress-fill {
          height: 100%;
          background-color: var(--clarity-outline-color-done);
          border-radius: 1px;
          transition: width 0.2s ease;
        }

        .progress-text {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 0.65em;
          font-weight: 600;
          text-align: center;
          user-select: none;
          white-space: nowrap;
          pointer-events: none;
        }

        /* Schedule and assign indicators */
        .outline-schedule {
          font-size: 0.85em;
          color: var(--clarity-outline-text-secondary);
          margin-left: 0.5rem;
        }

        .outline-assign {
          font-size: 0.85em;
          color: var(--clarity-outline-text-secondary);
          margin-left: 0.5rem;
        }

        .outline-tags {
          font-size: 0.85em;
          color: var(--clarity-outline-text-secondary);
          margin-left: 0.5rem;
        }

        /* Edit input styling */
        .outline-edit-input {
          flex: 1;
          background: var(--clarity-outline-input-bg);
          border: 1px solid var(--clarity-outline-input-border);
          color: var(--clarity-outline-text-primary);
          font-family: inherit;
          font-size: inherit;
          padding: var(--clarity-outline-input-padding);
          border-radius: var(--clarity-outline-input-border-radius);
          outline: none;
          min-width: 0;
          max-width: 100%;
        }

        /* Mobile-friendly edit input */
        @media (max-width: 768px) {
          .outline-edit-input {
            font-size: 16px; /* Prevents zoom on iOS */
            padding: 0.3rem 0.5rem;
          }
        }

        .outline-edit-input:focus {
          border-color: var(--clarity-outline-border-focus);
        }

        li.editing .outline-text {
          display: none;
        }





        /* Hover buttons */
        .outline-hover-buttons {
          display: none;
          margin-left: 0.5rem;
          gap: 0.5rem;
          align-items: center;
          flex-wrap: wrap;
          max-width: calc(100vw - 2rem);
          overflow: hidden;
        }

        /* Consistent spacing for hover buttons after child-count */
        .child-count + .outline-hover-buttons {
          margin-left: 0.5rem;
        }

        /* Mobile-friendly button container */
        @media (max-width: 768px) {
          .outline-hover-buttons {
            margin-left: 0.25rem;
            gap: 0.25rem;
            max-width: calc(100vw - 1rem);
            justify-content: flex-start;
          }
        }

        /* Note: Button visibility is now handled entirely by JavaScript */

        .hover-button {
          background: none;
          border: none;
          color: var(--clarity-outline-text-muted);
          padding: 0;
          font-size: 0.8em;
          cursor: pointer;
          user-select: none;
          white-space: nowrap;
          font-family: inherit;
          outline: none;
          min-width: 0;
          flex-shrink: 1;
        }

        /* Mobile-friendly button adjustments */
        @media (max-width: 768px) {
          .hover-button {
            font-size: 0.75em;
            padding: 0.1rem 0.2rem;
          }
        }

        .hover-button:hover {
          color: var(--clarity-outline-text-secondary) !important;
        }

        .hover-button.has-data {
          color: var(--clarity-outline-text-secondary);
        }

        .hover-button:not(.has-data) {
          color: var(--clarity-outline-text-muted);
          font-style: italic;
        }

        .hover-button.priority-button.has-data {
          color: var(--clarity-outline-color-priority);
          font-weight: bold;
        }

        .hover-button.blocked-button.has-data {
          color: var(--clarity-outline-color-blocked);
          font-weight: bold;
        }

        /* Priority and blocked indicators */
        .priority-indicator {
          color: var(--color-priority);
          margin-left: 0.3rem;
        }

                  .blocked-indicator {
          color: var(--color-blocked);
          margin-left: 0.3rem;
        }

        /* Popup styling */
        .outline-popup {
          position: absolute;
          background: var(--clarity-outline-popup-bg);
          border: 1px solid var(--clarity-outline-border);
          border-radius: var(--clarity-outline-popup-border-radius);
          padding: var(--clarity-outline-popup-padding);
          z-index: 1000;
          box-shadow: var(--clarity-outline-popup-shadow);
          min-width: var(--clarity-outline-popup-min-width);
        }

        /* Date popup */
        .date-popup {
          min-width: 150px;
        }

        /* Notes popup specific styling */
        .notes-popup {
          min-width: 200px;
          max-width: 400px;
          padding: 1rem;
        }

        .notes-popup .notes-textarea {
          width: 200px !important;
          min-height: 200px !important;
          max-height: 400px;
          resize: vertical;
          font-family: inherit;
          line-height: 1.4;
          box-sizing: border-box;
          border: 1px solid var(--clarity-outline-input-border);
          border-radius: var(--clarity-outline-input-border-radius);
          background: var(--clarity-outline-input-bg);
          color: var(--clarity-outline-text-primary);
        }

        .notes-popup .notes-textarea:focus {
          outline: none;
          border-color: var(--clarity-outline-border-focus);
          box-shadow: 0 0 0 2px var(--clarity-outline-focus-shadow);
        }

        /* Comments popup specific styling */
        .comments-popup {
          min-width: 200px;
          max-width: 400px;
          padding: 1rem;
        }

        .comments-popup .heading {
          margin-bottom: 0.5rem;
        }

        .comments-popup .comments-textarea {
          width: 200px !important;
          min-height: 150px !important;
          max-height: 400px;
          resize: vertical;
          font-family: inherit;
          line-height: 1.4;
          box-sizing: border-box;
          border: 1px solid var(--clarity-outline-input-border);
          border-radius: var(--clarity-outline-input-border-radius);
          background: var(--clarity-outline-input-bg);
          color: var(--clarity-outline-text-primary);
        }

        .comments-popup .comments-textarea:focus {
          outline: none;
          border-color: var(--clarity-outline-border-focus);
          box-shadow: 0 0 0 2px var(--clarity-outline-focus-shadow);
        }

        /* Worklog popup specific styling */
        .worklog-popup {
          min-width: 200px;
          max-width: 400px;
          padding: 1rem;
        }

        .worklog-popup .heading {
          margin-bottom: 0.5rem;
        }

        .worklog-popup .worklog-textarea {
          width: 200px !important;
          min-height: 150px !important;
          max-height: 400px;
          resize: vertical;
          font-family: inherit;
          line-height: 1.4;
          box-sizing: border-box;
          border: 1px solid var(--clarity-outline-input-border);
          border-radius: var(--clarity-outline-input-border-radius);
          background: var(--clarity-outline-input-bg);
          color: var(--clarity-outline-text-primary);
        }

        .worklog-popup .worklog-textarea:focus {
          outline: none;
          border-color: var(--clarity-outline-border-focus);
          box-shadow: 0 0 0 2px var(--clarity-outline-focus-shadow);
        }

        .date-popup button {
          background: none;
          border: none;
          color: var(--clarity-outline-text-secondary);
          cursor: pointer;
          font-family: inherit;
          padding: 0.3rem 0.6rem;
        }

        .date-popup button:hover {
          color: var(--clarity-outline-text-primary);
          background: var(--clarity-outline-hover);
          border-radius: 2px;
        }

        .date-popup button:focus {
          outline: none;
          color: var(--clarity-outline-text-primary);
          background: var(--clarity-outline-hover);
          border-radius: 2px;
        }

        .date-popup button:active {
          background: var(--clarity-outline-focus);
        }

        /* Dropdown popup */
        .dropdown-popup .dropdown-item {
          padding: 0.4rem 0.6rem;
          cursor: pointer;
          border-radius: 2px;
          color: var(--clarity-outline-text-secondary);
        }

        .dropdown-popup .dropdown-item:hover {
          background: var(--clarity-outline-bg-tertiary);
        }

        .dropdown-popup .dropdown-item.selected {
          background: transparent;
          color: var(--clarity-outline-text-primary);
          border: 2px solid var(--clarity-outline-border);
        }

        .dropdown-popup .dropdown-item:focus {
          outline: none;
          background: var(--clarity-outline-focus-highlight);
        }

        .dropdown-popup .tag-item label {
          display: flex;
          align-items: center;
          cursor: pointer;
          width: 100%;
        }

        .dropdown-popup .tag-item label input[type="checkbox"] {
          margin-right: 0.5rem;
          cursor: pointer;
        }

        .dropdown-popup .dropdown-input {
          width: 100%;
          box-sizing: border-box;
          background: var(--clarity-outline-input-bg);
          border: 1px solid var(--clarity-outline-input-border);
          color: var(--clarity-outline-text-primary);
          padding: 0.4rem;
          margin-bottom: 0.5rem;
          border-radius: var(--clarity-outline-input-border-radius);
          font-family: inherit;
        }

        .dropdown-popup .dropdown-input:focus {
          outline: none;
          border-color: var(--clarity-outline-border-focus);
          box-shadow: 0 0 0 2px var(--clarity-outline-focus-shadow);
        }

        /* Specific styling for date/datetime inputs to override browser defaults */
        input[type="date"].dropdown-input,
        input[type="datetime-local"].dropdown-input {
          -webkit-appearance: none;
          -moz-appearance: textfield;
          appearance: none;
        }

        input[type="date"].dropdown-input:focus,
        input[type="datetime-local"].dropdown-input:focus,
        .outline-popup input[type="date"]:focus,
        .outline-popup input[type="datetime-local"]:focus {
          outline: none !important;
          border: 1px solid var(--clarity-outline-border-focus) !important;
          box-shadow: 0 0 0 2px var(--clarity-outline-focus-shadow) !important;
          -webkit-appearance: none !important;
          -moz-appearance: textfield !important;
          appearance: none !important;
        }

        /* Permission denied feedback */
        li.permission-denied {
          background: rgba(255, 0, 0, 0.1) !important;
          border-left: 3px solid rgba(255, 0, 0, 0.5);
          animation: permission-denied-shake 0.5s ease-in-out;
        }

        @keyframes permission-denied-shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-2px); }
          75% { transform: translateX(2px); }
        }
      }
    `;
    this.shadowRoot.appendChild(style);
  }



  applyThemeFromParent() {
    // Get CSS custom properties from parent document
    const parentStyle = getComputedStyle(document.documentElement);

    // Apply them to the web component
    const properties = [
      '--clarity-outline-bg-primary', '--clarity-outline-bg-secondary', '--clarity-outline-bg-tertiary',
      '--clarity-outline-text-primary', '--clarity-outline-text-secondary', '--clarity-outline-text-muted',
      '--clarity-outline-border', '--clarity-outline-border-focus', '--clarity-outline-hover', '--clarity-outline-focus',
      '--clarity-outline-input-bg', '--clarity-outline-input-border', '--clarity-outline-popup-bg', '--clarity-outline-popup-shadow'
    ];

    properties.forEach(prop => {
      const value = parentStyle.getPropertyValue(prop);
      if (value) {
        this.style.setProperty(prop, value);
      }
    });
  }

  applyTheme(theme) {
    // Apply theme by setting CSS custom properties on the host element
    const host = this;
    
    // Clear any existing theme overrides
    const themeProperties = [
      '--clarity-outline-bg-primary', '--clarity-outline-bg-secondary', '--clarity-outline-bg-tertiary',
      '--clarity-outline-text-primary', '--clarity-outline-text-secondary', '--clarity-outline-text-muted',
      '--clarity-outline-border', '--clarity-outline-border-focus', '--clarity-outline-hover', 
      '--clarity-outline-focus', '--clarity-outline-focus-shadow', '--clarity-outline-focus-highlight',
      '--clarity-outline-input-bg', '--clarity-outline-input-border', '--clarity-outline-popup-bg', '--clarity-outline-popup-shadow'
    ];
    
    if (!theme || theme === 'auto') {
      // Remove theme overrides and let CSS media queries handle it
      themeProperties.forEach(prop => host.style.removeProperty(prop));
    } else if (theme === 'light') {
      // Apply light theme
      host.style.setProperty('--clarity-outline-bg-primary', '#ffffff');
      host.style.setProperty('--clarity-outline-bg-secondary', '#f8f9fa');
      host.style.setProperty('--clarity-outline-bg-tertiary', '#e9ecef');
      host.style.setProperty('--clarity-outline-text-primary', '#212529');
      host.style.setProperty('--clarity-outline-text-secondary', '#6c757d');
      host.style.setProperty('--clarity-outline-text-muted', '#adb5bd');
      host.style.setProperty('--clarity-outline-border', '#dee2e6');
      host.style.setProperty('--clarity-outline-border-focus', '#8a9ba8');
      host.style.setProperty('--clarity-outline-hover', 'rgba(0, 0, 0, 0.05)');
      host.style.setProperty('--clarity-outline-focus', 'rgba(0, 0, 0, 0.1)');
      host.style.setProperty('--clarity-outline-focus-shadow', 'rgba(138, 155, 168, 0.3)');
      host.style.setProperty('--clarity-outline-focus-highlight', 'rgba(138, 155, 168, 0.15)');
      host.style.setProperty('--clarity-outline-input-bg', '#ffffff');
      host.style.setProperty('--clarity-outline-input-border', '#e1e5e9');
      host.style.setProperty('--clarity-outline-popup-bg', '#ffffff');
      host.style.setProperty('--clarity-outline-popup-shadow', '0 4px 12px rgba(0, 0, 0, 0.15)');
    } else if (theme === 'dark') {
      // Apply dark theme with improved visibility
      host.style.setProperty('--clarity-outline-bg-primary', '#1e1e1e');
      host.style.setProperty('--clarity-outline-bg-secondary', '#2d2d2d');
      host.style.setProperty('--clarity-outline-bg-tertiary', '#333333');
      host.style.setProperty('--clarity-outline-text-primary', '#f8f8f2');
      host.style.setProperty('--clarity-outline-text-secondary', '#ddd');
      host.style.setProperty('--clarity-outline-text-muted', '#888');
      host.style.setProperty('--clarity-outline-border', '#555');
      host.style.setProperty('--clarity-outline-border-focus', '#b8c5d1');
      host.style.setProperty('--clarity-outline-hover', 'rgba(255, 255, 255, 0.08)');
      host.style.setProperty('--clarity-outline-focus', 'rgba(255, 255, 255, 0.15)');
      host.style.setProperty('--clarity-outline-focus-shadow', 'rgba(184, 197, 209, 0.4)');
      host.style.setProperty('--clarity-outline-focus-highlight', 'rgba(184, 197, 209, 0.35)');
      host.style.setProperty('--clarity-outline-input-bg', '#2d2d2d');
      host.style.setProperty('--clarity-outline-input-border', '#999');
      host.style.setProperty('--clarity-outline-popup-bg', '#2d2d2d');
      host.style.setProperty('--clarity-outline-popup-shadow', '0 4px 12px rgba(0, 0, 0, 0.3)');
    }
  }

  setupThemeListener() {
    // Listen for changes to the document's style attribute
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
          this.applyThemeFromParent();
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['style']
    });
  }

  forwardEvents() {
    const events = [
      'outline:add', 'outline:toggle', 'outline:move', 'outline:indent', 'outline:outdent',
      'outline:collapse', 'outline:expand', 'outline:edit:start', 'outline:edit:save',
      'outline:edit:cancel', 'outline:due', 'outline:assign', 'outline:tags',
              'outline:priority', 'outline:blocked', 'outline:open', 'outline:select',
      'outline:comment', 'outline:worklog', 'outline:archive', 'outline:permission-denied'
    ];

    // Get the list element where events are dispatched
    const listEl = this.shadowRoot.querySelector('.outline-list');

    events.forEach(eventName => {
      listEl.addEventListener(eventName, (e) => {
        // Create a new event that bubbles up from the web component
        const newEvent = new CustomEvent(eventName, {
          detail: e.detail,
          bubbles: true,
          composed: true
        });
        this.dispatchEvent(newEvent);
      });
    });
  }

  // Public API methods that delegate to the Outline instance
  getItems() {
    return this.todoList ? this.todoList.getItems() : [];
  }

  addItem(text, parentLi) {
    if (this.todoList) {
      this.todoList.addItem(text, parentLi);
    }
  }

  toggleItem(li) {
    if (this.todoList) {
      this.todoList.toggleItem(li);
    }
  }

  enterEditMode(li) {
    if (this.todoList) {
      this.todoList.enterEditMode(li);
    }
  }

  // Getter for the Outline instance
  get todoListInstance() {
    return this.todoList;
  }
}

// Register the web component
customElements.define('clarity-outline', OutlineElement);

// Export for module systems if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { OutlineElement };
}

class Outline {
  constructor(el, options = {}) {
    this.el = el;
    this.options = {
      assignees: options.assignees || [],
      tags: options.tags || [],
      statusLabels: options.statusLabels || [
        { label: 'TODO', isEndState: false },
        { label: 'DONE', isEndState: true }
      ],
      features: {
        priority: options.features?.priority !== false, // default: true
        blocked: options.features?.blocked !== false, // default: true
        dueDate: options.features?.dueDate !== false, // default: true
        assign: options.features?.assign !== false, // default: true
        tags: options.features?.tags !== false, // default: true
        notes: options.features?.notes !== false, // default: true
        remove: options.features?.remove !== false, // default: true
        // status, edit, and open are always enabled (non-customizable)
      },
      ...options
    };
    this.init();
  }

  init() {
    this.el.querySelectorAll("li").forEach(li => {
      li.tabIndex = 0;
      this.addHoverButtons(li);
    });
    this.bindEvents();
    this.initNewTodoButton();

    // Initialize child counts for existing items
    this.el.querySelectorAll("li").forEach(li => {
      this.updateChildCount(li);
    });

    // Initialize hover button visibility for all items
    this.el.querySelectorAll("li").forEach(li => {
      this.updateHoverButtonsVisibility(li);
    });
  }

  initNewTodoButton() {
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
    // Create a new todo item and enter edit mode immediately
    const newLi = document.createElement("li");
    newLi.tabIndex = 0;
    newLi.dataset.id = crypto.randomUUID();

    // Create the label span
    const labelSpan = document.createElement("span");
    labelSpan.className = "outline-label";
    labelSpan.textContent = "TODO";

    // Create the text span
    const textSpan = document.createElement("span");
    textSpan.className = "outline-text";
    textSpan.textContent = "New todo";

    newLi.appendChild(labelSpan);
    newLi.appendChild(document.createTextNode(" "));
    newLi.appendChild(textSpan);

    // Add hover buttons
    this.addHoverButtons(newLi);

    // Add to the list
    this.el.appendChild(newLi);

    // Enter edit mode immediately
    this.enterEditMode(newLi);

    // Emit add event
    this.emit("outline:add", {
      text: "New todo",
      id: newLi.dataset.id,
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

      // Single click: just focus/select the item (no navigation)
      li.focus();
      console.log("Todo item selected", li.dataset.id);

      this.emit("outline:select", {
        id: li.dataset.id,
        text: li.querySelector(".outline-text").textContent
      });
    });

    // Add double-click for navigation to solo view
    this.el.addEventListener("dblclick", e => {
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

      // Double click: navigate to solo view
      console.log("Todo item double-clicked - navigating", li.dataset.id);
      this.navigateToSoloView(li);
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
          if (e.key === 'd' || e.key === 'a' || e.key === 't') {
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
        this.enterEditMode(li);
        return;
      }

      // Add/cycle tags with 't' key
      if(e.key==="t" && !e.altKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const tagsBtn = li.querySelector(".tags-button");
        if (tagsBtn) {
          this.showTagsPopup(li, tagsBtn);
        }
        return;
      }

      // Toggle priority with 'p' key (only if enabled)
      if(e.key==="p" && !e.altKey && !e.ctrlKey && !e.metaKey && this.options.features.priority) {
        e.preventDefault();
        this.togglePriority(li);
        return;
      }

      // Toggle blocked with 'b' key (only if enabled)
      if(e.key==="b" && !e.altKey && !e.ctrlKey && !e.metaKey && this.options.features.blocked) {
        e.preventDefault();
        this.toggleBlocked(li);
        return;
      }

      // Set due date with 'd' key (only if enabled)
      if(e.key==="d" && !e.altKey && !e.ctrlKey && !e.metaKey && this.options.features.dueDate) {
        e.preventDefault();
        const scheduleBtn = li.querySelector(".schedule-button");
        if (scheduleBtn) {
          this.showSchedulePopup(li, scheduleBtn);
        }
        return;
      }

      // Add notes with 'n' key (only if enabled)
      if(e.key==="n" && !e.altKey && !e.ctrlKey && !e.metaKey && this.options.features.notes) {
        e.preventDefault();
        const notesBtn = li.querySelector(".notes-button");
        if (notesBtn) {
          this.showNotesPopup(li, notesBtn);
        }
        return;
      }

      // Remove item with 'r' key (only if enabled)
      if(e.key==="r" && !e.altKey && !e.ctrlKey && !e.metaKey && this.options.features.remove) {
        e.preventDefault();
        const removeBtn = li.querySelector(".remove-button");
        if (removeBtn) {
          this.showRemovePopup(li, removeBtn);
        }
        return;
      }

      // Status with 's' key (always enabled)
      if(e.key==="s" && !e.altKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const stateBtn = li.querySelector(".state-button");
        if (stateBtn) {
          this.showStatusPopup(li, stateBtn);
        }
        return;
      }

      // Assign with 'a' key (only if enabled)
      if(e.key==="a" && !e.altKey && !e.ctrlKey && !e.metaKey && this.options.features.assign) {
        e.preventDefault();
        const assignBtn = li.querySelector(".assign-button");
        if (assignBtn) {
          this.showAssignPopup(li, assignBtn);
        }
        return;
      }

      // Open solo view with 'o' key
      if(e.key==="o" && !e.altKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        this.navigateToSoloView(li);
        return;
      }

      // Navigate to solo view with Enter
      if(e.key==="Enter" && !e.altKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        this.navigateToSoloView(li);
        return;
      }

      // Create new sibling todo with Alt+Enter
      if(e.key==="Enter" && e.altKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        this.addSiblingTodo(li);
        return;
      }

      // Cycle collapsed/expanded with Alt+Tab
      if(e.key==="Tab" && e.altKey && !e.ctrlKey && !e.metaKey) {
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

      // Navigate with arrow keys
      if(e.key==="ArrowDown") {
        e.preventDefault();
        if(idx < siblings.length - 1) {
          siblings[idx+1].focus();
        } else {
          // last child, move to next available item by traversing up the hierarchy
          this.navigateToNextItem(li);
        }
      }

      if(e.key==="ArrowUp") {
        e.preventDefault();
        if(idx > 0) {
          siblings[idx-1].focus();
        } else {
          // first child, move focus to parent li if exists
          const parentLi = li.parentNode.closest("li");
          if(parentLi) parentLi.focus();
        }
      }

      // Navigate with emacs bindings (Ctrl+N/P/F/B)
      if(e.key==="n" && e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        if(idx < siblings.length - 1) {
          siblings[idx+1].focus();
        } else {
          // last child, move to next available item by traversing up the hierarchy
          this.navigateToNextItem(li);
        }
      }

      if(e.key==="p" && e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        if(idx > 0) {
          siblings[idx-1].focus();
        } else {
          // first child, move focus to parent li if exists
          const parentLi = li.parentNode.closest("li");
          if(parentLi) parentLi.focus();
        }
      }

      // Emacs Ctrl+F (forward) and Ctrl+B (backward) for horizontal navigation
      if(e.key==="f" && e.ctrlKey && !e.altKey && !e.metaKey) {
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
      }

      if(e.key==="b" && e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        const parentLi = li.parentNode.closest("li");
        if (parentLi) {
          parentLi.focus();
        }
      }

      // Navigate with vi bindings (J/K for up/down, H/L for left/right)
      if(e.key==="j" && !e.altKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if(idx < siblings.length - 1) {
          siblings[idx+1].focus();
        } else {
          // last child, move to next available item by traversing up the hierarchy
          this.navigateToNextItem(li);
        }
      }

      if(e.key==="k" && !e.altKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if(idx > 0) {
          siblings[idx-1].focus();
        } else {
          // first child, move focus to parent li if exists
          const parentLi = li.parentNode.closest("li");
          if(parentLi) parentLi.focus();
        }
      }

      // Vi-style left/right navigation
      if(e.key==="h" && !e.altKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const parentLi = li.parentNode.closest("li");
        if (parentLi) {
          parentLi.focus();
        }
      }

      if(e.key==="l" && !e.altKey && !e.ctrlKey && !e.metaKey) {
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
      }

      // Navigate into first child with right arrow (if no Alt)
      // Navigate into first child with right arrow (if no Alt)
      if (!e.altKey && e.key === "ArrowRight") {
        const sublist = li.querySelector("ul");
        if (sublist && sublist.children.length > 0) {
          e.preventDefault();

          // If collapsed, expand first-level children only
          if (li.classList.contains("collapsed")) {
            this.expandItem(li); // only expands direct children
          }

          const firstChild = sublist.querySelector("li");
          if (firstChild) firstChild.focus();
        }
      }


      // Navigate back to parent with left arrow (if no Alt)
      if (!e.altKey && e.key === "ArrowLeft") {
        const parentLi = li.parentNode.closest("li");
        if (parentLi) {
          e.preventDefault();
          parentLi.focus();
        }
      }



      // Alt keys
      if(e.altKey){
        // Reorder
        if(e.key==="ArrowUp" && idx>0){
          e.preventDefault();
          li.parentNode.insertBefore(li, siblings[idx-1]);
          li.focus();
          this.emit("outline:move",{id:li.dataset.id,from:idx,to:idx-1});
        }
        if(e.key==="ArrowDown" && idx<siblings.length-1){
          e.preventDefault();
          li.parentNode.insertBefore(siblings[idx+1], li);
          li.focus();
          this.emit("outline:move",{id:li.dataset.id,from:idx,to:idx+1});
        }
        // Hierarchy
        if(e.key==="ArrowRight"){ e.preventDefault(); this.indentItem(li); }
        if(e.key==="ArrowLeft"){ e.preventDefault(); this.outdentItem(li); }
        // Collapse / Expand
        if(e.key.toUpperCase()==="H"){ e.preventDefault(); this.collapseItem(li); }
        if(e.key.toUpperCase()==="L"){ e.preventDefault(); this.expandItem(li); }

        // Emacs-style Alt+N/P/F/B for moving items
        if(e.key==="n" && idx<siblings.length-1){
          e.preventDefault();
          li.parentNode.insertBefore(li, siblings[idx+1]);
          li.focus();
          this.emit("outline:move",{id:li.dataset.id,from:idx,to:idx+1});
        }
        if(e.key==="p" && idx>0){
          e.preventDefault();
          li.parentNode.insertBefore(li, siblings[idx-1]);
          li.focus();
          this.emit("outline:move",{id:li.dataset.id,from:idx,to:idx-1});
        }
        if(e.key==="f"){
          e.preventDefault();
          this.indentItem(li);
        }
        if(e.key==="b"){
          e.preventDefault();
          this.outdentItem(li);
        }

        // Vi-style Alt+H/J/K/L for moving items
        if(e.key==="j" && idx<siblings.length-1){
          e.preventDefault();
          li.parentNode.insertBefore(li, siblings[idx+1]);
          li.focus();
          this.emit("outline:move",{id:li.dataset.id,from:idx,to:idx+1});
        }
        if(e.key==="k" && idx>0){
          e.preventDefault();
          li.parentNode.insertBefore(li, siblings[idx-1]);
          li.focus();
          this.emit("outline:move",{id:li.dataset.id,from:idx,to:idx-1});
        }
        if(e.key==="l"){
          e.preventDefault();
          this.indentItem(li);
        }
        if(e.key==="h"){
          e.preventDefault();
          this.outdentItem(li);
        }
      }
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

    if (!countSpan) {
        countSpan = document.createElement("span");
        countSpan.className = "child-count";
    }

    // Always position the child-count correctly (whether new or existing)
    this.positionChildCount(li, countSpan);

    // Show count only if there are completable children
    if (completableChildren.length > 0) {
        countSpan.textContent = `[${doneCount}/${completableChildren.length}]`;
        countSpan.style.display = "";
    } else {
        // Remove the count span entirely when no completable children
        countSpan.remove();
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
          // Alt+Enter: Save current edit and add new todo
          this.saveEdit(li, input.value);
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

  navigateToSoloView(li) {
    const todoId = li.dataset.id;
    const todoText = li.querySelector(".outline-text")?.textContent;
    const todoStatus = li.classList.contains("completed") ? "completed" :
                      li.classList.contains("no-label") ? "heading" : "todo";

    // Navigate to todo detail page with URL parameters
    // Navigation to todo detail page removed - todo.html no longer exists
// const url = `demos/todo.html?id=${encodeURIComponent(todoId)}&text=${encodeURIComponent(todoText)}&status=${encodeURIComponent(todoStatus)}`;
    // window.location.href = url;

    this.emit("outline:navigate", {
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
      li.classList.remove("no-label");
      label.style.display = "";
      label.textContent = this.options.statusLabels[0].label;
    } else if (currentIndex >= 0 && currentIndex < this.options.statusLabels.length - 1 && !this.options.statusLabels[currentIndex].isEndState) {
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
      // fallback: no label → first status
      nextState = `status-0`;
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
      li.classList.remove("no-label");
      li.classList.add("completed");
      label.style.display = "";
      label.textContent = this.options.statusLabels[lastEndStateIndex].label;
    } else if (currentIndex > 0) {
      // current status → previous status
      nextState = `status-${currentIndex - 1}`;
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
    // Don't add buttons if they already exist
    if (li.querySelector(".outline-hover-buttons")) return;

    const buttonsContainer = document.createElement("div");
    buttonsContainer.className = "outline-hover-buttons";

    // Priority button (only if enabled)
    if (this.options.features.priority) {
      const priorityBtn = document.createElement("button");
      priorityBtn.className = "hover-button priority-button";
      priorityBtn.setAttribute("data-type", "priority");
      priorityBtn.tabIndex = -1; // Remove from tab navigation
      priorityBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.togglePriority(li);
      });
      buttonsContainer.appendChild(priorityBtn);
    }

          // Blocked button (only if enabled)
      if (this.options.features.blocked) {
        const blockedBtn = document.createElement("button");
        blockedBtn.className = "hover-button blocked-button";
        blockedBtn.setAttribute("data-type", "blocked");
        blockedBtn.tabIndex = -1; // Remove from tab navigation
        blockedBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          this.toggleBlocked(li);
        });
        buttonsContainer.appendChild(blockedBtn);
      }

    // Schedule button (only if enabled)
    if (this.options.features.dueDate) {
      const scheduleBtn = document.createElement("button");
      scheduleBtn.className = "hover-button schedule-button";
      scheduleBtn.setAttribute("data-type", "schedule");
      scheduleBtn.tabIndex = -1; // Remove from tab navigation
      scheduleBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.showSchedulePopup(li, scheduleBtn);
      });
      buttonsContainer.appendChild(scheduleBtn);
    }

    // Assign button (only if enabled)
    if (this.options.features.assign) {
      const assignBtn = document.createElement("button");
      assignBtn.className = "hover-button assign-button";
      assignBtn.setAttribute("data-type", "assign");
      assignBtn.tabIndex = -1; // Remove from tab navigation
      assignBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.showAssignPopup(li, assignBtn);
      });
      buttonsContainer.appendChild(assignBtn);
    }

    // Tags button (only if enabled)
    if (this.options.features.tags) {
      const tagsBtn = document.createElement("button");
      tagsBtn.className = "hover-button tags-button";
      tagsBtn.setAttribute("data-type", "tags");
      tagsBtn.tabIndex = -1; // Remove from tab navigation
      tagsBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.showTagsPopup(li, tagsBtn);
      });
      buttonsContainer.appendChild(tagsBtn);
    }

    // Notes button (only if enabled)
    if (this.options.features.notes) {
      const notesBtn = document.createElement("button");
      notesBtn.className = "hover-button notes-button";
      notesBtn.setAttribute("data-type", "notes");
      notesBtn.tabIndex = -1; // Remove from tab navigation
      notesBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.showNotesPopup(li, notesBtn);
      });
      buttonsContainer.appendChild(notesBtn);
    }

    // Remove button (only if enabled)
    if (this.options.features.remove) {
      const removeBtn = document.createElement("button");
      removeBtn.className = "hover-button remove-button";
      removeBtn.setAttribute("data-type", "remove");
      removeBtn.tabIndex = -1; // Remove from tab navigation
      removeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.showRemovePopup(li, removeBtn);
      });
      buttonsContainer.appendChild(removeBtn);
    }

    // State button (for cycling TODO/DONE/no-label) - always enabled
    const stateBtn = document.createElement("button");
    stateBtn.className = "hover-button state-button";
    stateBtn.setAttribute("data-type", "state");
    stateBtn.tabIndex = -1; // Remove from tab navigation
    stateBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.showStatusPopup(li, stateBtn);
    });
    buttonsContainer.appendChild(stateBtn);

    // Edit button - always enabled
    const editBtn = document.createElement("button");
    editBtn.className = "hover-button edit-button";
    editBtn.setAttribute("data-type", "edit");
    editBtn.textContent = "edit";
    editBtn.tabIndex = -1; // Remove from tab navigation
    editBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.enterEditMode(li);
    });
    buttonsContainer.appendChild(editBtn);

    // Open button (for navigating to solo view) - always enabled
    const openBtn = document.createElement("button");
    openBtn.className = "hover-button open-button";
    openBtn.setAttribute("data-type", "open");
    openBtn.innerHTML = "<u>o</u>pen";
    openBtn.tabIndex = -1; // Remove from tab navigation
    openBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.navigateToSoloView(li);
    });
    buttonsContainer.appendChild(openBtn);

    // Reorder buttons: open, status, edit, remove, then others
    const desiredOrder = [
      '.open-button',
      '.state-button',
      '.edit-button',
      '.remove-button',
      '.priority-button',
      '.blocked-button',
      '.schedule-button',
      '.assign-button',
      '.tags-button',
      '.notes-button'
    ];
    desiredOrder.forEach(selector => {
      const btn = buttonsContainer.querySelector(selector);
      if (btn) {
        buttonsContainer.appendChild(btn);
      }
    });

    // Insert after the child-count if it exists, otherwise after the text span
    const childCount = li.querySelector(".child-count");
    if (childCount) {
      childCount.after(buttonsContainer);
    } else {
      const textSpan = li.querySelector(".outline-text");
      if (textSpan) {
        textSpan.after(buttonsContainer);
      } else {
        li.appendChild(buttonsContainer);
      }
    }

    // Add hover delay functionality
    this.addHoverDelayHandlers(li, buttonsContainer);

    // Update button text based on current data
    this.updateHoverButtons(li);
  }

  addHoverDelayHandlers(li, buttonsContainer) {
    let hoverTimeout;
    const delay = 600; // 600ms delay before showing buttons

    li.addEventListener('mouseenter', () => {
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

    li.addEventListener('mouseleave', () => {
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
    const scheduleBtn = li.querySelector(".schedule-button");
    const assignBtn = li.querySelector(".assign-button");
    const tagsBtn = li.querySelector(".tags-button");
    const notesBtn = li.querySelector(".notes-button");
    const removeBtn = li.querySelector(".remove-button");
    const stateBtn = li.querySelector(".state-button");
    const editBtn = li.querySelector(".edit-button");
    const openBtn = li.querySelector(".open-button");

    // Only require the always-enabled buttons to exist
    if (!stateBtn || !editBtn || !openBtn) return;

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

    // Update schedule button (if enabled)
    if (scheduleBtn) {
      const scheduleSpan = li.querySelector(".outline-schedule");
      if (scheduleSpan && scheduleSpan.textContent.trim()) {
        scheduleBtn.textContent = scheduleSpan.textContent.trim();
        scheduleBtn.classList.add("has-data");
        hasAnyData = true;
      } else {
        scheduleBtn.innerHTML = "<u>d</u>ue on";
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

    // Update notes button (if enabled)
    if (notesBtn) {
      const notesSpan = li.querySelector(".outline-notes");
      if (notesSpan && notesSpan.textContent.trim()) {
        notesBtn.textContent = "notes";
        notesBtn.classList.add("has-data");
        hasAnyData = true;
      } else {
        notesBtn.innerHTML = "<u>n</u>otes";
        notesBtn.classList.remove("has-data");
      }
    }

    // Update remove button (if enabled)
    if (removeBtn) {
      const hasChildren = !!li.querySelector("ul > li");
      removeBtn.innerHTML = hasChildren ? "<u>r</u>emove…" : "<u>r</u>emove";
      removeBtn.classList.remove("has-data");
    }

    // State button always shows "status"
    stateBtn.innerHTML = "<u>s</u>tatus";
    stateBtn.classList.remove("has-data");

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
      state: 1,
      edit: 2,
      remove: 3,
      priority: 4,
      blocked: 5,
      schedule: 6,
      assign: 7,
      tags: 8,
      notes: 9
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
    // Append to the todo list container, not document.body
    this.el.style.position = 'relative'; // Ensure container is positioned
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

    popup.style.left = `${left}px`;
    popup.style.top = `${top}px`;
  }

  showSchedulePopup(li, button) {
    this.closeAllPopups();

    // Add popup-active class to keep metadata visible
    li.classList.add('popup-active');
    this.updateHoverButtonsVisibility(li);

    const popup = document.createElement('div');
    popup.className = 'outline-popup date-popup';

    // Date input
    const dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateInput.className = 'dropdown-input';

    // Get current date if set, otherwise use today
    const existingScheduleSpan = li.querySelector('.outline-schedule');
    let initialDate = new Date();

    if (existingScheduleSpan && existingScheduleSpan.textContent.trim()) {
      // Try to parse existing date (format: " Jan 5")
      const dateText = existingScheduleSpan.textContent.trim();
      console.log('Parsing date text:', dateText); // Debug

      const currentYear = new Date().getFullYear();

      // Handle different date formats
      let parsedDate;
      if (dateText.includes(' ')) {
        // Format: "Jan 5" or " Jan 5"
        const dateWithYear = `${dateText} ${currentYear}`;
        console.log('Trying to parse:', dateWithYear); // Debug
        parsedDate = new Date(dateWithYear);

        // Fix timezone issue by creating date in local timezone
        if (!isNaN(parsedDate.getTime())) {
          const month = parsedDate.getMonth();
          const day = parsedDate.getDate();
          initialDate = new Date(currentYear, month, day);
          console.log('Created local date:', initialDate); // Debug
        }
      } else {
        // Try direct parsing
        parsedDate = new Date(dateText);
        if (!isNaN(parsedDate.getTime())) {
          initialDate = parsedDate;
        }
      }

      console.log('Parsed date:', parsedDate, 'Valid:', !isNaN(parsedDate.getTime())); // Debug
    }

    // Use toLocaleDateString to avoid timezone issues
    const year = initialDate.getFullYear();
    const month = String(initialDate.getMonth() + 1).padStart(2, '0');
    const day = String(initialDate.getDate()).padStart(2, '0');
    dateInput.value = `${year}-${month}-${day}`;
    console.log('Final date input value:', dateInput.value); // Debug

    popup.appendChild(dateInput);

    // Add button container for better layout
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '0.5rem';
    buttonContainer.style.marginTop = '0.5rem';

    // Add confirm button
    const confirmButton = document.createElement('button');
    confirmButton.textContent = 'Set Date';
    confirmButton.className = 'hover-button';
    confirmButton.style.padding = '0.3rem 0.6rem';
    confirmButton.style.flex = '1';
    confirmButton.type = 'button'; // Ensure it's a button

    // Handle confirm button click and keyboard
    const handleConfirm = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (dateInput.value) {
        const selectedDate = new Date(dateInput.value + 'T00:00:00');
        this.setScheduleDate(li, selectedDate);
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

    // Add clear button
    const clearButton = document.createElement('button');
    clearButton.textContent = 'Clear';
    clearButton.className = 'hover-button';
    clearButton.style.padding = '0.3rem 0.6rem';
    clearButton.style.flex = '1';
    clearButton.type = 'button'; // Ensure it's a button

    // Handle clear button click and keyboard
    const handleClear = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.clearScheduleDate(li);
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

    dateInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeAllPopups(li);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (dateInput.value) {
          const selectedDate = new Date(dateInput.value + 'T00:00:00');
          this.setScheduleDate(li, selectedDate);
          this.closeAllPopups();
        }
      } else if (e.key === 'Tab') {
        // Allow normal tab navigation to buttons
        // Don't prevent default - let it move to next focusable element
      }
    });

    // Position popup relative to the list container
    this.positionPopup(popup, button);

    // Focus the input
    setTimeout(() => dateInput.focus(), 0);

    // Store reference for cleanup
    this.currentPopup = popup;

    // Close on outside click - simplified approach
    setTimeout(() => {
      const handleOutsideClick = (e) => {
        // Don't close if clicking inside the popup, on date picker elements, or within the web component
        if (popup.contains(e.target) || e.target.matches('input[type="date"]') || e.target.closest('outline-list')) {
          return;
        }

        // Close popup and remove listener
        this.closeAllPopups(li);
        document.removeEventListener('click', handleOutsideClick);
      };

      document.addEventListener('click', handleOutsideClick);

      // Store reference to remove listener when popup closes
      popup._outsideClickHandler = handleOutsideClick;
    }, 100); // Increased timeout to ensure date picker is ready
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

    const timestamp = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
    scheduleSpan.textContent = ` ${timestamp}`;

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

    noneItem.addEventListener('click', () => {
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

      item.addEventListener('click', () => {
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
      document.addEventListener('click', (e) => {
        if (!popup.contains(e.target)) {
          this.closeAllPopups(li);
        }
      }, { once: true });
    }, 0);
  }

  handleDropdownKeydown(e, item, selectCallback, li) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectCallback();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextItem = item.nextElementSibling;
      if (nextItem) nextItem.focus();
    } else if (e.key === 'ArrowUp') {
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
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          const nextItem = item.nextElementSibling || input;
          nextItem.focus();
        } else if (e.key === 'ArrowUp') {
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
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const firstItem = popup.querySelector('.tag-item');
        if (firstItem) firstItem.focus();
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

    // Close on outside click - simplified approach
    setTimeout(() => {
      const handleOutsideClick = (e) => {
        // Don't close if clicking inside the popup or within the web component
        if (popup.contains(e.target) || e.target.closest('outline-list')) {
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

  showNotesPopup(li, button) {
    this.closeAllPopups();

    // Keep metadata visible
    li.classList.add('popup-active');
    this.updateHoverButtonsVisibility(li);

    const popup = document.createElement('div');
    popup.className = 'outline-popup date-popup notes-popup';

    const textarea = document.createElement('textarea');
    textarea.className = 'dropdown-input';
    textarea.placeholder = 'Add notes…';
    textarea.style.padding = '0.5rem';
    textarea.rows = 4;

    // Prefill from existing
    const existingNotesSpan = li.querySelector('.outline-notes');
    if (existingNotesSpan && existingNotesSpan.textContent) {
      textarea.value = existingNotesSpan.textContent.trim();
    }
    popup.appendChild(textarea);

    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '0.5rem';
    buttonContainer.style.marginTop = '0.5rem';

    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
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
      this.setNotes(li, textarea.value.trim());
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
        if (popup.contains(e.target) || e.target.closest('outline-list')) return;
        this.closeAllPopups(li);
        document.removeEventListener('click', handleOutsideClick);
      };
      document.addEventListener('click', handleOutsideClick);
      popup._outsideClickHandler = handleOutsideClick;
    }, 100);
  }

  setNotes(li, notesText) {
    const textSpan = li.querySelector('.outline-text');
    if (!textSpan) return;
    let notesSpan = li.querySelector('.outline-notes');
    if (!notesSpan) {
      notesSpan = document.createElement('span');
      notesSpan.className = 'outline-notes';
      notesSpan.style.display = 'none';
      const buttonsContainer = li.querySelector('.outline-hover-buttons');
      if (buttonsContainer) {
        buttonsContainer.after(notesSpan);
      } else {
        textSpan.after(notesSpan);
      }
    }
    notesSpan.textContent = notesText ? ` ${notesText}` : '';
    if (!notesText) {
      notesSpan.remove();
    }
    this.updateHoverButtons(li);
    li.focus();
    this.emit('outline:notes', {
      id: li.dataset.id,
      text: textSpan.textContent,
      notes: notesText || null
    });
  }

  showRemovePopup(li, button) {
    this.closeAllPopups();
    li.classList.add('popup-active');
    this.updateHoverButtonsVisibility(li);

    const popup = document.createElement('div');
    popup.className = 'outline-popup date-popup remove-popup';

    const hasChildren = !!li.querySelector('ul > li');
    const heading = document.createElement('div');
    heading.textContent = hasChildren ? 'Remove this and all nested items?' : 'Remove?';
    popup.appendChild(heading);

    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '0.5rem';
    buttonContainer.style.marginTop = '0.5rem';

    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = 'Remove';
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

    const handleRemove = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.removeItem(li);
      this.closeAllPopups();
    };
    const handleCancel = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.closeAllPopups(li);
    };
    confirmBtn.addEventListener('click', handleRemove);
    cancelBtn.addEventListener('click', handleCancel);

    buttonContainer.appendChild(confirmBtn);
    buttonContainer.appendChild(cancelBtn);
    popup.appendChild(buttonContainer);

    confirmBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { this.closeAllPopups(li); }
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRemove(e); }
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
        if (popup.contains(e.target) || e.target.closest('outline-list')) return;
        this.closeAllPopups(li);
        document.removeEventListener('click', handleOutsideClick);
      };
      document.addEventListener('click', handleOutsideClick);
      popup._outsideClickHandler = handleOutsideClick;
    }, 0);
  }

  removeItem(li) {
    const id = li.dataset.id;
    const textSpan = li.querySelector('.outline-text');
    const detailText = textSpan ? textSpan.textContent : '';
    const parentLi = li.parentNode.closest('li');
    const parentUl = li.parentNode;
    
    // Find the next element to focus on before removing the current one
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
    
    this.emit('outline:remove', { id, text: detailText });
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

      // Handle click
      item.addEventListener('click', () => {
        this.setTodoStatus(li, option.value);
        this.closeAllPopups();
      });

      // Handle keyboard
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.setTodoStatus(li, option.value);
          this.closeAllPopups();
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          const nextItem = item.nextElementSibling;
          if (nextItem) nextItem.focus();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          const prevItem = item.previousElementSibling;
          if (prevItem) prevItem.focus();
        } else if (e.key === 'Escape') {
          this.closeAllPopups(li);
        }
      });

      popup.appendChild(item);
    });

    // Position popup relative to the list container
    this.positionPopup(popup, button);

    // Focus first item
    setTimeout(() => {
      const firstItem = popup.querySelector('.dropdown-item');
      if (firstItem) firstItem.focus();
    }, 0);

    // Close on outside click
    setTimeout(() => {
      document.addEventListener('click', (e) => {
        if (!popup.contains(e.target)) {
          this.closeAllPopups(li);
        }
      }, { once: true });
    }, 0);
  }

  setTodoStatus(li, status) {
    const label = li.querySelector(".outline-label");
    if (!label) return;

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

    // Apply theme from parent document
    this.applyThemeFromParent();

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

    // Parse feature options from data-features attribute
    const features = this.getAttribute('data-features');
    if (features) {
      try {
        options.features = JSON.parse(features);
      } catch (e) {
        console.warn('Invalid features format, using default');
      }
    }

    // Parse options from options attribute (JSON)
    const optionsAttr = this.getAttribute('options');
    if (optionsAttr) {
      try {
        const parsedOptions = JSON.parse(optionsAttr);
        Object.assign(options, parsedOptions);
      } catch (e) {
        console.warn('Invalid options JSON, using individual attributes');
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
      classes: Array.from(li.classList).join(' ')
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
      countSpan.textContent = `[${completedCount}/${todo.children.length}]`;
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
    }
  }

  // Static getter for observed attributes
  static get observedAttributes() {
    return ['data-items'];
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
          --clarity-outline-light-border-focus: #007bff;
          --clarity-outline-light-hover: rgba(0, 0, 0, 0.05);
          --clarity-outline-light-focus: rgba(0, 0, 0, 0.1);
          --clarity-outline-light-input-bg: #ffffff;
          --clarity-outline-light-input-border: #ced4da;
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
          --clarity-outline-dark-border-focus: #7aa2e3;
          --clarity-outline-dark-hover: rgba(255, 255, 255, 0.05);
          --clarity-outline-dark-focus: rgba(255, 255, 255, 0.1);
          --clarity-outline-dark-input-bg: #2d2d2d;
          --clarity-outline-dark-input-border: #555;
          --clarity-outline-dark-popup-bg: #2d2d2d;
          --clarity-outline-dark-popup-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);

          /* Semantic colors */
          --clarity-outline-color-todo: #d16d7a;
          --clarity-outline-color-done: #6c757d;
          --clarity-outline-color-priority: #5f9fb0;
          --clarity-outline-color-blocked: #f39c12;

          /* Theme variables - inherit from parent or use defaults */
          --clarity-outline-bg-primary: var(--clarity-outline-bg-primary, #1e1e1e);
          --clarity-outline-bg-secondary: var(--clarity-outline-bg-secondary, #2d2d2d);
          --clarity-outline-bg-tertiary: var(--clarity-outline-bg-tertiary, #333333);
          --clarity-outline-text-primary: var(--clarity-outline-text-primary, #f8f8f2);
          --clarity-outline-text-secondary: var(--clarity-outline-text-secondary, #ddd);
          --clarity-outline-text-muted: var(--clarity-outline-text-muted, #888);
          --clarity-outline-border: var(--clarity-outline-border, #555);
          --clarity-outline-border-focus: var(--clarity-outline-border-focus, #7aa2e3);
          --clarity-outline-hover: var(--clarity-outline-hover, rgba(255, 255, 255, 0.05));
          --clarity-outline-focus: var(--clarity-outline-focus, rgba(255, 255, 255, 0.1));
          --clarity-outline-input-bg: var(--clarity-outline-input-bg, #2d2d2d);
          --clarity-outline-input-border: var(--clarity-outline-input-border, #555);
          --clarity-outline-popup-bg: var(--clarity-outline-popup-bg, #2d2d2d);
          --clarity-outline-popup-shadow: var(--clarity-outline-popup-shadow, 0 4px 12px rgba(0, 0, 0, 0.3));

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
        overflow-x: hidden;

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
          z-index: 100;
          box-shadow: var(--clarity-outline-popup-shadow);
          min-width: var(--clarity-outline-popup-min-width);
        }

        /* Date popup */
        .date-popup {
          min-width: 150px;
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
          background: var(--clarity-outline-color-done);
          color: var(--clarity-outline-bg-primary);
        }

        .dropdown-popup .dropdown-item:focus {
          outline: none;
          background: rgba(102, 217, 239, 0.3);
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
          background: var(--clarity-outline-bg-tertiary);
          border: 1px solid var(--clarity-outline-border);
          color: var(--clarity-outline-text-primary);
          padding: 0.4rem;
          margin-bottom: 0.5rem;
          border-radius: 2px;
          font-family: inherit;
        }

        .dropdown-popup .dropdown-input:focus {
          outline: none;
          border-color: var(--clarity-outline-border-focus);
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
              'outline:priority', 'outline:blocked', 'outline:navigate', 'outline:select',
      'outline:notes', 'outline:remove'
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

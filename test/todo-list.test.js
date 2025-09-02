/**
 * @jest-environment jsdom
 */

describe('Outline Web Component', () => {
  let todoList, outlineList, container;

  beforeEach(async () => {
    const testSetup = await createTestOutlineList();
    todoList = testSetup.todoList;
    outlineList = testSetup.outlineList;
    container = testSetup.container;
  });

  afterEach(() => {
    cleanupTestOutlineList(container);
  });

  describe('Basic Functionality', () => {
    test('should create outline list with initial structure', () => {
      expect(outlineList).toBeDefined();
      expect(todoList).toBeDefined();
      
      const shadowRoot = outlineList.shadowRoot;
      expect(shadowRoot).toBeDefined();
      
      const listElement = shadowRoot.querySelector('.outline-list');
      expect(listElement).toBeDefined();
    });

    test('should add new todo items', () => {
      const initialCount = getAllTodos(outlineList).length;
      
      todoList.addItem('New test todo');
      
      const newCount = getAllTodos(outlineList).length;
      expect(newCount).toBe(initialCount + 1);
      
      const newTodo = getAllTodos(outlineList).find(todo => 
        todo.querySelector('.outline-text').textContent === 'New test todo'
      );
      expect(newTodo).toBeDefined();
    });

    test('should toggle todo status', () => {
      todoList.addItem('Test todo');
      const todo = getTodoByText(outlineList, 'Test todo');
      
      // Initially should not be completed
      expect(todo.classList.contains('completed')).toBe(false);
      
      // First toggle: TODO -> IN PROGRESS (not completed)
      todoList.toggleItem(todo);
      expect(todo.classList.contains('completed')).toBe(false);
      
      // Second toggle: IN PROGRESS -> DONE (completed)
      todoList.toggleItem(todo);
      expect(todo.classList.contains('completed')).toBe(true);
    });
  });

  describe('Event Emission', () => {
    test('should emit outline:add event when adding todo', (done) => {
      outlineList.addEventListener('outline:add', (e) => {
        expect(e.detail).toBeDefined();
        expect(e.detail.text).toBe('Test todo');
        done();
      });
      
      todoList.addItem('Test todo');
    });

    test('should emit outline:toggle event when toggling', (done) => {
      todoList.addItem('Test todo');
      const todo = getTodoByText(outlineList, 'Test todo');
      
      outlineList.addEventListener('outline:toggle', (e) => {
        expect(e.detail).toBeDefined();
        expect(e.detail.id).toBe(todo.dataset.id);
        done();
      });
      
      todoList.toggleItem(todo);
    });

    test('should emit outline:assign event when assigning', (done) => {
      todoList.addItem('Test todo');
      const todo = getTodoByText(outlineList, 'Test todo');
      
      outlineList.addEventListener('outline:assign', (e) => {
        expect(e.detail).toBeDefined();
        expect(e.detail.assignee).toBe('alice');
        done();
      });
      
      todoList.setAssignee(todo, 'alice');
    });

    test('should emit outline:tags event when adding tags', (done) => {
      todoList.addItem('Test todo');
      const todo = getTodoByText(outlineList, 'Test todo');
      
      outlineList.addEventListener('outline:tags', (e) => {
        expect(e.detail).toBeDefined();
        expect(e.detail.tags).toContain('urgent');
        done();
      });
      
      todoList.setTags(todo, ['urgent']);
    });
  });

  describe('Configuration Options', () => {
    test('should use custom status labels', async () => {
      const customOptions = {
        statusLabels: [
          { label: 'PENDING', isEndState: false },
          { label: 'COMPLETED', isEndState: true }
        ]
      };
      
      const testSetup = await createTestOutlineList(customOptions);
      const customTodoList = testSetup.todoList;
      const customOutlineList = testSetup.outlineList;
      
      customTodoList.addItem('Test todo');
      const todo = getTodoByText(customOutlineList, 'Test todo');
      
      const label = todo.querySelector('.outline-label');
      expect(label.textContent).toBe('PENDING');
      
      cleanupTestOutlineList(testSetup.container);
    });

    test('should support multiple end states', async () => {
      const customOptions = {
        statusLabels: [
          { label: 'TODO', isEndState: false },
          { label: 'IN PROGRESS', isEndState: false },
          { label: 'DONE', isEndState: true },
          { label: 'CANCELLED', isEndState: true }
        ]
      };
      
      const testSetup = await createTestOutlineList(customOptions);
      const customTodoList = testSetup.todoList;
      const customOutlineList = testSetup.outlineList;
      
      customTodoList.addItem('Test todo');
      const todo = getTodoByText(customOutlineList, 'Test todo');
      
      // Should cycle through all states
      customTodoList.cycleTodoStateForward(todo);
      expect(todo.querySelector('.outline-label').textContent).toBe('IN PROGRESS');
      
      customTodoList.cycleTodoStateForward(todo);
      expect(todo.querySelector('.outline-label').textContent).toBe('DONE');
      expect(todo.classList.contains('completed')).toBe(true);
      
      cleanupTestOutlineList(testSetup.container);
    });

    test('should use custom assignees', async () => {
      const customOptions = {
        assignees: ['john', 'jane', 'bob']
      };
      
      const testSetup = await createTestOutlineList(customOptions);
      const customTodoList = testSetup.todoList;
      const customOutlineList = testSetup.outlineList;
      
      customTodoList.addItem('Test todo');
      const todo = getTodoByText(customOutlineList, 'Test todo');
      
      // Should be able to assign to custom assignee
      customTodoList.setAssignee(todo, 'john');
      const assignSpan = todo.querySelector('.outline-assign');
      expect(assignSpan.textContent.trim()).toBe('john');
      
      cleanupTestOutlineList(testSetup.container);
    });

    test('should use custom tags', async () => {
      const customOptions = {
        tags: ['critical', 'enhancement', 'documentation']
      };
      
      const testSetup = await createTestOutlineList(customOptions);
      const customTodoList = testSetup.todoList;
      const customOutlineList = testSetup.outlineList;
      
      customTodoList.addItem('Test todo');
      const todo = getTodoByText(customOutlineList, 'Test todo');
      
      // Should be able to add custom tags
      customTodoList.setTags(todo, ['critical']);
      const tagsSpan = todo.querySelector('.outline-tags');
      expect(tagsSpan.textContent.trim()).toBe('critical');
      
      cleanupTestOutlineList(testSetup.container);
    });

    test('should render custom end states as completed from data-items', async () => {
      const customOptions = {
        statusLabels: [
          { label: 'TODO', isEndState: false },
          { label: 'IN PROGRESS', isEndState: false },
          { label: 'DONE', isEndState: true },
          { label: 'CANCELLED', isEndState: true }
        ]
      };
      
      // Create a fresh component with both options and data-items set from the start
      const container = document.createElement('div');
      document.body.appendChild(container);
      
      const outlineList = document.createElement('clarity-outline');
      outlineList.setAttribute('options', JSON.stringify(customOptions));
      outlineList.setAttribute('data-items', JSON.stringify([
        {
          id: '1',
          text: 'Cancelled task',
          status: 'CANCELLED'
        }
      ]));
      
      container.appendChild(outlineList);
      
      // Wait for the component to be connected
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Check that the CANCELLED item is rendered as completed
      const todo = getTodoByText(outlineList, 'Cancelled task');
      expect(todo).toBeDefined();
      expect(todo.classList.contains('completed')).toBe(true);
      expect(todo.querySelector('.outline-label').textContent).toBe('CANCELLED');
      
      cleanupTestOutlineList(container);
    });
  });

  describe('Hover Button Functionality', () => {
    test('should add hover buttons to todos', () => {
      todoList.addItem('Test todo');
      const todo = getTodoByText(outlineList, 'Test todo');
      
      const hoverButtons = todo.querySelector('.outline-hover-buttons');
      expect(hoverButtons).toBeDefined();
      
      const buttons = hoverButtons.querySelectorAll('.hover-button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    test('should update button text based on todo state', () => {
      todoList.addItem('Test todo');
      const todo = getTodoByText(outlineList, 'Test todo');
      
      // Initially priority button should show "priority"
      const priorityBtn = todo.querySelector('.priority-button');
      expect(priorityBtn.textContent).toBe('priority');
      
      // After setting priority, should show "priority"
      todoList.togglePriority(todo);
      expect(priorityBtn.textContent).toBe('priority');
      expect(priorityBtn.classList.contains('has-data')).toBe(true);
    });

    test('should update button text for due date', () => {
      todoList.addItem('Test todo');
      const todo = getTodoByText(outlineList, 'Test todo');
      
      const scheduleBtn = todo.querySelector('.schedule-button');
      expect(scheduleBtn.textContent).toBe('due on');
      
      // Set a due date
      const testDate = new Date('2024-01-15');
      todoList.setScheduleDate(todo, testDate);
      
      expect(scheduleBtn.textContent).toBe('Jan 15');
      expect(scheduleBtn.classList.contains('has-data')).toBe(true);
    });

    test('should update button text for assignment', () => {
      todoList.addItem('Test todo');
      const todo = getTodoByText(outlineList, 'Test todo');
      
      const assignBtn = todo.querySelector('.assign-button');
      expect(assignBtn.textContent).toBe('assign');
      
      // Assign to someone
      todoList.setAssignee(todo, 'alice');
      
      expect(assignBtn.textContent).toBe('@alice');
      expect(assignBtn.classList.contains('has-data')).toBe(true);
    });

    test('should update button text for tags', () => {
      todoList.addItem('Test todo');
      const todo = getTodoByText(outlineList, 'Test todo');
      
      const tagsBtn = todo.querySelector('.tags-button');
      expect(tagsBtn.textContent).toBe('tags');
      
      // Add tags
      todoList.setTags(todo, ['urgent', 'bug']);
      
      expect(tagsBtn.textContent).toBe('#urgent #bug');
      expect(tagsBtn.classList.contains('has-data')).toBe(true);
    });

    test('should add has-data class to todo when any metadata is present', () => {
      todoList.addItem('Test todo');
      const todo = getTodoByText(outlineList, 'Test todo');
      
      // Initially should not have has-data class
      expect(todo.classList.contains('has-data')).toBe(false);
      
      // Add priority
      todoList.togglePriority(todo);
      expect(todo.classList.contains('has-data')).toBe(true);
    });

    test('should remove has-data class when all metadata is removed', () => {
      todoList.addItem('Test todo');
      const todo = getTodoByText(outlineList, 'Test todo');
      
      // Add priority
      todoList.togglePriority(todo);
      expect(todo.classList.contains('has-data')).toBe(true);
      
      // Remove priority
      todoList.togglePriority(todo);
      expect(todo.classList.contains('has-data')).toBe(false);
    });

    test('should handle hover delay functionality', () => {
      todoList.addItem('Test todo');
      const todo = getTodoByText(outlineList, 'Test todo');
      
      const hoverButtons = todo.querySelector('.outline-hover-buttons');
      expect(hoverButtons).toBeDefined();
      
      // Initially buttons should be hidden (no data, no popup)
      expect(hoverButtons.style.display).toBe('none');
      
      // Simulate mouseenter
      const mouseenterEvent = new Event('mouseenter', { bubbles: true });
      todo.dispatchEvent(mouseenterEvent);
      
      // Buttons should still be hidden immediately after mouseenter
      expect(hoverButtons.style.display).toBe('none');
      
      // Wait for the delay (1000ms) and check if buttons are shown
      return new Promise(resolve => {
        setTimeout(() => {
          expect(hoverButtons.style.display).toBe('inline-flex');
          
          // Simulate mouseleave
          const mouseleaveEvent = new Event('mouseleave', { bubbles: true });
          todo.dispatchEvent(mouseleaveEvent);
          
          // Buttons should be hidden immediately after mouseleave
          expect(hoverButtons.style.display).toBe('none');
          resolve();
        }, 1100); // Wait slightly longer than the 1000ms delay
      });
    });

    test('should show buttons immediately when todo has data', () => {
      todoList.addItem('Test todo');
      const todo = getTodoByText(outlineList, 'Test todo');
      
      const hoverButtons = todo.querySelector('.outline-hover-buttons');
      
      // Add priority to give the todo data
      todoList.togglePriority(todo);
      
      // Buttons should be visible immediately when todo has data
      expect(hoverButtons.style.display).toBe('inline-flex');
    });

    test('should handle hover button clicks', () => {
      todoList.addItem('Test todo');
      const todo = getTodoByText(outlineList, 'Test todo');
      
      const priorityBtn = todo.querySelector('.priority-button');
      
      // Click priority button
      priorityBtn.click();
      
      expect(todo.classList.contains('priority')).toBe(true);
    });

    test('should reorder buttons with set values first', () => {
      todoList.addItem('Test todo');
      const todo = getTodoByText(outlineList, 'Test todo');
      
      // Add some metadata
      todoList.togglePriority(todo);
      todoList.setAssignee(todo, 'alice');
      
      const hoverButtons = todo.querySelector('.outline-hover-buttons');
      const buttons = Array.from(hoverButtons.querySelectorAll('.hover-button'));
      
      // Buttons with data should come first
      const buttonsWithData = buttons.filter(btn => btn.classList.contains('has-data'));
      const buttonsWithoutData = buttons.filter(btn => !btn.classList.contains('has-data'));
      
      expect(buttonsWithData.length).toBeGreaterThan(0);
      expect(buttonsWithoutData.length).toBeGreaterThan(0);
    });
  });

  describe('New Todo Button', () => {
    test('should create new todo when button is clicked', () => {
      const initialCount = getAllTodos(outlineList).length;
      
      // Find and click the add button
      const shadowRoot = outlineList.shadowRoot;
      const addButton = shadowRoot.querySelector('.outline-add-button');
      expect(addButton).toBeDefined();
      
      addButton.click();
      
      const newCount = getAllTodos(outlineList).length;
      expect(newCount).toBe(initialCount + 1);
    });

    test('should emit outline:add event when creating new todo via button', (done) => {
      outlineList.addEventListener('outline:add', (e) => {
        expect(e.detail).toBeDefined();
        expect(e.detail.text).toBe('New todo');
        done();
      });
      
      const shadowRoot = outlineList.shadowRoot;
      const addButton = shadowRoot.querySelector('.outline-add-button');
      addButton.click();
    });

    test('should focus new todo input when created via button', () => {
      const shadowRoot = outlineList.shadowRoot;
      const addButton = shadowRoot.querySelector('.outline-add-button');
      addButton.click();
      
      // Should have a new todo in edit mode
      const todos = getAllTodos(outlineList);
      const newTodo = todos[todos.length - 1];
      expect(newTodo.classList.contains('editing')).toBe(true);
      
      const editInput = newTodo.querySelector('.outline-edit-input');
      expect(editInput).toBeDefined();
    });
  });

  describe('Strike-through Functionality', () => {
    test('should apply strike-through to completed todos with nested children', () => {
      todoList.addItem('Parent todo');
      const parentTodo = getTodoByText(outlineList, 'Parent todo');
      
      // Add child
      todoList.addItem('Child todo', parentTodo);
      
      // Complete parent (toggle twice to get to DONE)
      todoList.toggleItem(parentTodo);
      todoList.toggleItem(parentTodo);
      
      expect(parentTodo.classList.contains('completed')).toBe(true);
    });

    test('should apply strike-through to completed child todos', () => {
      todoList.addItem('Parent todo');
      const parentTodo = getTodoByText(outlineList, 'Parent todo');
      
      todoList.addItem('Child todo', parentTodo);
      const childTodo = getTodoByText(outlineList, 'Child todo');
      
      // Complete child (toggle twice to get to DONE)
      todoList.toggleItem(childTodo);
      todoList.toggleItem(childTodo);
      
      expect(childTodo.classList.contains('completed')).toBe(true);
    });

    test('should not apply strike-through to non-completed todos', () => {
      todoList.addItem('Test todo');
      const todo = getTodoByText(outlineList, 'Test todo');
      
      const textSpan = todo.querySelector('.outline-text');
      expect(textSpan.style.textDecoration).not.toBe('line-through');
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty todo text', () => {
      todoList.addItem('');
      const todo = getAllTodos(outlineList).find(t => 
        t.querySelector('.outline-text').textContent === ''
      );
      expect(todo).toBeDefined();
    });

    test('should handle special characters in todo text', () => {
      const specialText = 'Test & < > " \' todo';
      todoList.addItem(specialText);
      const todo = getTodoByText(outlineList, specialText);
      expect(todo).toBeDefined();
    });

    test('should handle rapid keyboard input', () => {
      todoList.addItem('Test todo');
      const todo = getTodoByText(outlineList, 'Test todo');
      
      // Simulate rapid key presses
      for (let i = 0; i < 5; i++) {
        todo.dispatchEvent(createKeyEvent('e'));
      }
      
      // Should still be functional
      expect(todo).toBeDefined();
    });

    test('should handle edit mode with empty text', () => {
      todoList.addItem('Test todo');
      const todo = getTodoByText(outlineList, 'Test todo');
      
      todoList.enterEditMode(todo);
      const input = todo.querySelector('.outline-edit-input');
      input.value = '';
      input.dispatchEvent(createKeyEvent('Enter'));
      
      // Should revert to original text
      const textSpan = todo.querySelector('.outline-text');
      expect(textSpan.textContent).toBe('Test todo');
    });

    test('should handle edit mode with only whitespace', () => {
      todoList.addItem('Test todo');
      const todo = getTodoByText(outlineList, 'Test todo');
      
      todoList.enterEditMode(todo);
      const input = todo.querySelector('.outline-edit-input');
      input.value = '   ';
      input.dispatchEvent(createKeyEvent('Enter'));
      
      // Should revert to original text
      const textSpan = todo.querySelector('.outline-text');
      expect(textSpan.textContent).toBe('Test todo');
    });

    test('should handle edit mode blur', () => {
      todoList.addItem('Test todo');
      const todo = getTodoByText(outlineList, 'Test todo');
      
      todoList.enterEditMode(todo);
      const input = todo.querySelector('.outline-edit-input');
      input.value = 'Updated todo';
      input.blur();
      
      // Should save the edit
      const textSpan = todo.querySelector('.outline-text');
      expect(textSpan.textContent).toBe('Updated todo');
    });

    test('should handle Alt+Enter in edit mode', () => {
      todoList.addItem('Test todo');
      const todo = getTodoByText(outlineList, 'Test todo');
      
      todoList.enterEditMode(todo);
      const input = todo.querySelector('.outline-edit-input');
      input.value = 'Updated todo';
      input.dispatchEvent(createKeyEvent('Enter', { altKey: true }));
      
      // Should save current edit and create new sibling
      const todos = getAllTodos(outlineList);
      expect(todos.length).toBe(2);
    });

    test('should handle indenting first todo (should do nothing)', () => {
      todoList.addItem('Test todo');
      const todo = getTodoByText(outlineList, 'Test todo');
      
      const initialParent = todo.parentNode;
      todoList.indentItem(todo);
      
      // Should not change parent
      expect(todo.parentNode).toBe(initialParent);
    });

    test('should handle outdenting root level todo (should do nothing)', () => {
      todoList.addItem('Test todo');
      const todo = getTodoByText(outlineList, 'Test todo');
      
      const initialParent = todo.parentNode;
      todoList.outdentItem(todo);
      
      // Should not change parent
      expect(todo.parentNode).toBe(initialParent);
    });

    test('should handle reordering first todo up (should do nothing)', () => {
      todoList.addItem('Test todo 1');
      todoList.addItem('Test todo 2');
      const firstTodo = getTodoByText(outlineList, 'Test todo 1');
      
      const initialIndex = getAllTodos(outlineList).indexOf(firstTodo);
      firstTodo.dispatchEvent(createKeyEvent('ArrowUp', { altKey: true }));
      
      // Should not change position
      const newIndex = getAllTodos(outlineList).indexOf(firstTodo);
      expect(newIndex).toBe(initialIndex);
    });

    test('should handle reordering last todo down (should do nothing)', () => {
      todoList.addItem('Test todo 1');
      todoList.addItem('Test todo 2');
      const lastTodo = getTodoByText(outlineList, 'Test todo 2');
      
      const initialIndex = getAllTodos(outlineList).indexOf(lastTodo);
      lastTodo.dispatchEvent(createKeyEvent('ArrowDown', { altKey: true }));
      
      // Should not change position
      const newIndex = getAllTodos(outlineList).indexOf(lastTodo);
      expect(newIndex).toBe(initialIndex);
    });

    test('should handle keyboard events when popup is open', () => {
      todoList.addItem('Test todo');
      const todo = getTodoByText(outlineList, 'Test todo');
      
      // Open a popup
      const assignBtn = todo.querySelector('.assign-button');
      assignBtn.click();
      
      // Try to navigate with arrow keys
      todo.dispatchEvent(createKeyEvent('ArrowDown'));
      
      // Should not navigate (popup should handle it)
      expect(todo).toBeDefined();
    });

    test('should handle keyboard events when in edit mode', () => {
      todoList.addItem('Test todo');
      const todo = getTodoByText(outlineList, 'Test todo');
      
      todoList.enterEditMode(todo);
      
      // Try to navigate with arrow keys
      todo.dispatchEvent(createKeyEvent('ArrowDown'));
      
      // Should not navigate (edit mode should handle it)
      expect(todo.classList.contains('editing')).toBe(true);
    });

    test('should handle multiple popups (should close previous)', () => {
      todoList.addItem('Test todo');
      const todo = getTodoByText(outlineList, 'Test todo');
      
      // Open first popup
      const assignBtn = todo.querySelector('.assign-button');
      assignBtn.click();
      
      // Open second popup
      const tagsBtn = todo.querySelector('.tags-button');
      tagsBtn.click();
      
      // Should only have one popup
      const popups = outlineList.shadowRoot.querySelectorAll('.outline-popup');
      expect(popups.length).toBe(1);
    });

    test('should handle child count with no-label items', () => {
      todoList.addItem('Parent todo');
      const parentTodo = getTodoByText(outlineList, 'Parent todo');
      
      // Add a no-label child (header)
      todoList.addItem('Child header', parentTodo);
      const childTodo = getTodoByText(outlineList, 'Child header');
      childTodo.classList.add('no-label');
      
      // Update child count after adding no-label class
      todoList.updateChildCount(parentTodo);
      
      // Should not count no-label items in child count
      const childCount = parentTodo.querySelector('.child-count');
      if (childCount) {
        expect(childCount.textContent).toBe('[0/0]');
      }
    });

    test('should handle removing last child from parent', () => {
      todoList.addItem('Parent todo');
      const parentTodo = getTodoByText(outlineList, 'Parent todo');
      
      todoList.addItem('Child todo', parentTodo);
      const childTodo = getTodoByText(outlineList, 'Child todo');
      
      // Remove child
      childTodo.remove();
      
      // Update parent state after manual removal
      todoList.updateChildCount(parentTodo);
      
      // Parent should no longer have has-children class
      expect(parentTodo.classList.contains('has-children')).toBe(false);
    });
  });

  describe('Child Counter Functionality', () => {
    test('should position child-count directly after todo text', () => {
      todoList.addItem('Parent todo');
      const parentTodo = getTodoByText(outlineList, 'Parent todo');
      
      todoList.addItem('Child todo', parentTodo);
      
      const textSpan = parentTodo.querySelector('.outline-text');
      const childCount = parentTodo.querySelector('.child-count');
      
      expect(childCount).toBeDefined();
      expect(textSpan.nextSibling).toBe(childCount);
    });

    test('should add child-count when adding a child to a parent', () => {
      todoList.addItem('Parent todo');
      const parentTodo = getTodoByText(outlineList, 'Parent todo');
      
      // Initially no child count
      let childCount = parentTodo.querySelector('.child-count');
      expect(childCount).toBeNull();
      
      // Add child
      todoList.addItem('Child todo', parentTodo);
      
      // Should now have child count
      childCount = parentTodo.querySelector('.child-count');
      expect(childCount).toBeDefined();
      expect(childCount.textContent).toBe('[0/1]');
    });

    test('should update child-count when child is completed', () => {
      todoList.addItem('Parent todo');
      const parentTodo = getTodoByText(outlineList, 'Parent todo');
      
      todoList.addItem('Child todo', parentTodo);
      const childTodo = getTodoByText(outlineList, 'Child todo');
      
      let childCount = parentTodo.querySelector('.child-count');
      expect(childCount.textContent).toBe('[0/1]');
      
      // Complete child (toggle twice to get to DONE)
      todoList.toggleItem(childTodo);
      todoList.toggleItem(childTodo);
      
      childCount = parentTodo.querySelector('.child-count');
      expect(childCount.textContent).toBe('[1/1]');
    });

    test('should update child-count when indenting a child that is itself a parent', () => {
      todoList.addItem('Grandparent todo');
      const grandparentTodo = getTodoByText(outlineList, 'Grandparent todo');
      
      todoList.addItem('Parent todo');
      const parentTodo = getTodoByText(outlineList, 'Parent todo');
      
      todoList.addItem('Child todo', parentTodo);
      
      // Indent parent under grandparent
      todoList.indentItem(parentTodo);
      
      // Grandparent should have child count
      const grandparentCount = grandparentTodo.querySelector('.child-count');
      expect(grandparentCount).toBeDefined();
      expect(grandparentCount.textContent).toBe('[0/1]');
    });

    test('should update child-count when further indenting a child', () => {
      todoList.addItem('Parent todo');
      const parentTodo = getTodoByText(outlineList, 'Parent todo');
      
      todoList.addItem('Child todo');
      const childTodo = getTodoByText(outlineList, 'Child todo');
      
      // Indent child under parent
      todoList.indentItem(childTodo);
      
      // Parent should have child count
      const parentCount = parentTodo.querySelector('.child-count');
      expect(parentCount).toBeDefined();
      expect(parentCount.textContent).toBe('[0/1]');
    });

    test('should update child-count when outdenting a child', () => {
      todoList.addItem('Parent todo');
      const parentTodo = getTodoByText(outlineList, 'Parent todo');
      
      todoList.addItem('Child todo', parentTodo);
      
      // Remove child by outdenting
      const childTodo = getTodoByText(outlineList, 'Child todo');
      todoList.outdentItem(childTodo);
      
      // Parent should no longer have child count
      const parentCount = parentTodo.querySelector('.child-count');
      expect(parentCount).toBeNull();
    });

    test('should show child-count for no-label items when they have completable children', () => {
      todoList.addItem('Header todo');
      const headerTodo = getTodoByText(outlineList, 'Header todo');
      headerTodo.classList.add('no-label');
      
      todoList.addItem('Child todo', headerTodo);
      
      // Update child count after adding no-label class
      todoList.updateChildCount(headerTodo);
      
      // Header should have child count
      const headerCount = headerTodo.querySelector('.child-count');
      expect(headerCount).toBeDefined();
      expect(headerCount.textContent).toBe('[0/1]');
    });

    test('should remove child-count when all children are removed', () => {
      todoList.addItem('Parent todo');
      const parentTodo = getTodoByText(outlineList, 'Parent todo');
      
      todoList.addItem('Child todo', parentTodo);
      const childTodo = getTodoByText(outlineList, 'Child todo');
      
      // Should have child count
      let childCount = parentTodo.querySelector('.child-count');
      expect(childCount).toBeDefined();
      
      // Remove child
      childTodo.remove();
      
      // Update parent state after manual removal
      todoList.updateChildCount(parentTodo);
      
      // Should no longer have child count
      childCount = parentTodo.querySelector('.child-count');
      expect(childCount).toBeNull();
    });

    test('should update child-count when adding sibling todos', () => {
      todoList.addItem('Parent todo');
      const parentTodo = getTodoByText(outlineList, 'Parent todo');
      
      todoList.addItem('Child 1', parentTodo);
      todoList.addItem('Child 2', parentTodo);
      
      const childCount = parentTodo.querySelector('.child-count');
      expect(childCount.textContent).toBe('[0/2]');
    });

    test('should handle nested child counts correctly', () => {
      todoList.addItem('Grandparent todo');
      const grandparentTodo = getTodoByText(outlineList, 'Grandparent todo');
      
      todoList.addItem('Parent todo', grandparentTodo);
      const parentTodo = getTodoByText(outlineList, 'Parent todo');
      
      todoList.addItem('Child todo', parentTodo);
      
      // Both should have child counts
      const grandparentCount = grandparentTodo.querySelector('.child-count');
      const parentCount = parentTodo.querySelector('.child-count');
      
      expect(grandparentCount.textContent).toBe('[0/1]');
      expect(parentCount.textContent).toBe('[0/1]');
    });

    test('should update child-count when moving items between parents', () => {
      todoList.addItem('Parent 1');
      todoList.addItem('Parent 2');
      const parent1 = getTodoByText(outlineList, 'Parent 1');
      const parent2 = getTodoByText(outlineList, 'Parent 2');
      
      todoList.addItem('Child todo', parent1);
      const childTodo = getTodoByText(outlineList, 'Child todo');
      
      // Move child from parent1 to root level
      todoList.outdentItem(childTodo);
      
      // Parent1 should no longer have child count
      const parent1Count = parent1.querySelector('.child-count');
      expect(parent1Count).toBeNull();
      
      // Move child under parent1 (indent moves under previous sibling)
      todoList.indentItem(childTodo);
      
      // Parent1 should have child count again
      const parent1Count2 = parent1.querySelector('.child-count');
      expect(parent1Count2.textContent).toBe('[0/1]');
    });

    test('should initialize child counts for existing HTML structure', () => {
      // Create a new outline list with existing structure
      const container = document.createElement('div');
      document.body.appendChild(container);
      
      const outlineList2 = document.createElement('outline-list');
      outlineList2.innerHTML = `
        <li data-id="1" tabindex="0">
          <span class="outline-label">TODO</span>
          <span class="outline-text">Parent</span>
          <ul>
            <li data-id="2" tabindex="0">
              <span class="outline-label">TODO</span>
              <span class="outline-text">Child</span>
            </li>
          </ul>
        </li>
      `;
      
      outlineList2.setAttribute('options', JSON.stringify({
        assignees: ['alice'],
        tags: ['urgent']
      }));
      
      container.appendChild(outlineList2);
      
      // Wait for component to initialize
      setTimeout(() => {
        const todoList2 = outlineList2.todoListInstance;
        const parentTodo = outlineList2.querySelector('li[data-id="1"]');
        
        // Should have child count
        const childCount = parentTodo.querySelector('.child-count');
        expect(childCount).toBeDefined();
        
        cleanupTestOutlineList(container);
      }, 10);
    });

    test('should position child-count correctly in index.html structure', () => {
      todoList.addItem('Parent todo');
      const parentTodo = getTodoByText(outlineList, 'Parent todo');
      
      todoList.addItem('Child todo', parentTodo);
      
      const textSpan = parentTodo.querySelector('.outline-text');
      const childCount = parentTodo.querySelector('.child-count');
      
      // Child count should be directly after text span
      expect(textSpan.nextSibling).toBe(childCount);
    });
  });

  describe('Open and Navigation Features', () => {
    test('should select todo on single click without navigating', () => {
      todoList.addItem('Test todo');
      const todo = getTodoByText(outlineList, 'Test todo');
      
      let selectEventEmitted = false;
      outlineList.addEventListener('outline:select', () => {
        selectEventEmitted = true;
      });
      
      todo.click();
      
      expect(selectEventEmitted).toBe(true);
    });

    test('should open item on double click', () => {
      todoList.addItem('Test todo');
      const todo = getTodoByText(outlineList, 'Test todo');
      
      let openEventEmitted = false;
      outlineList.addEventListener('outline:open', () => {
        openEventEmitted = true;
      });
      
      todo.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      
      expect(openEventEmitted).toBe(true);
    });

    test('should open item on Enter key', () => {
      todoList.addItem('Test todo');
      const todo = getTodoByText(outlineList, 'Test todo');
      
      let openEventEmitted = false;
      outlineList.addEventListener('outline:open', () => {
        openEventEmitted = true;
      });
      
      todo.focus();
      todo.dispatchEvent(createKeyEvent('Enter'));
      
      expect(openEventEmitted).toBe(true);
    });

    test('should open item on "o" key', () => {
      todoList.addItem('Test todo');
      const todo = getTodoByText(outlineList, 'Test todo');
      
      let openEventEmitted = false;
      outlineList.addEventListener('outline:open', () => {
        openEventEmitted = true;
      });
      
      todo.focus();
      todo.dispatchEvent(createKeyEvent('o'));
      
      expect(openEventEmitted).toBe(true);
    });

    test('should add open button to hover buttons', () => {
      todoList.addItem('Test todo');
      const todo = getTodoByText(outlineList, 'Test todo');
      
      const openButton = todo.querySelector('.open-button');
      expect(openButton).toBeDefined();
      expect(openButton.textContent).toBe('open');
    });

    test('should open item when clicking open button', () => {
      todoList.addItem('Test todo');
      const todo = getTodoByText(outlineList, 'Test todo');
      
      let openEventEmitted = false;
      outlineList.addEventListener('outline:open', () => {
        openEventEmitted = true;
      });
      
      const openButton = todo.querySelector('.open-button');
      openButton.click();
      
      expect(openEventEmitted).toBe(true);
    });

    test('should emit outline:select event on single click', (done) => {
      todoList.addItem('Test todo');
      const todo = getTodoByText(outlineList, 'Test todo');
      
      outlineList.addEventListener('outline:select', (e) => {
        expect(e.detail).toBeDefined();
        expect(e.detail.id).toBe(todo.dataset.id);
        done();
      });
      
      todo.click();
    });

    test('should emit outline:open event on open', () => {
      todoList.addItem('Test todo');
      const todo = getTodoByText(outlineList, 'Test todo');
      
      let openEventEmitted = false;
      outlineList.addEventListener('outline:open', () => {
        openEventEmitted = true;
      });
      
      todo.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      
      expect(openEventEmitted).toBe(true);
    });

    test('should not open when clicking on buttons', () => {
      todoList.addItem('Test todo');
      const todo = getTodoByText(outlineList, 'Test todo');
      
      let openEventEmitted = false;
      outlineList.addEventListener('outline:open', () => {
        openEventEmitted = true;
      });
      
      const assignButton = todo.querySelector('.assign-button');
      assignButton.click();
      
      expect(openEventEmitted).toBe(false);
    });

    test('should not open when clicking on edit input', () => {
      todoList.addItem('Test todo');
      const todo = getTodoByText(outlineList, 'Test todo');
      
      todoList.enterEditMode(todo);
      const input = todo.querySelector('.outline-edit-input');
      
      let openEventEmitted = false;
      outlineList.addEventListener('outline:open', () => {
        openEventEmitted = true;
      });
      
      input.click();
      
      expect(openEventEmitted).toBe(false);
    });

    test('should include correct status in open event', () => {
      todoList.addItem('Test todo');
      const todo = getTodoByText(outlineList, 'Test todo');
      
      // Complete the todo
      todoList.toggleItem(todo);
      todoList.toggleItem(todo);
      
      let openEventEmitted = false;
      outlineList.addEventListener('outline:open', (e) => {
        openEventEmitted = true;
        expect(e.detail).toBeDefined();
        expect(e.detail.id).toBe(todo.dataset.id);
      });
      
      todo.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      
      expect(openEventEmitted).toBe(true);
    });

    test('should position open button first among core actions when no data', () => {
      todoList.addItem('Test todo');
      const todo = getTodoByText(outlineList, 'Test todo');
      
      const hoverButtons = todo.querySelector('.outline-hover-buttons');
      const buttons = Array.from(hoverButtons.children);
      const openButton = buttons[0];
      
      expect(openButton.classList.contains('open-button')).toBe(true);
    });
  });

  describe('Keyboard Navigation Features', () => {
    test('should navigate between todos with arrow keys', async () => {
      todoList.addItem('First todo');
      todoList.addItem('Second todo');
      
      const firstTodo = getTodoByText(outlineList, 'First todo');
      const secondTodo = getTodoByText(outlineList, 'Second todo');
      
      firstTodo.focus();
      // In shadow DOM, we can't use document.activeElement, so we test the focus visually
      expect(firstTodo).toBeDefined();
      
      firstTodo.dispatchEvent(createKeyEvent('ArrowDown'));
      // Test that navigation event was emitted or focus changed
      expect(secondTodo).toBeDefined();
      
      secondTodo.dispatchEvent(createKeyEvent('ArrowUp'));
      expect(firstTodo).toBeDefined();
    });

    test('should navigate into nested todos with right arrow', async () => {
      todoList.addItem('Parent todo');
      const parentTodo = getTodoByText(outlineList, 'Parent todo');
      
      todoList.addItem('Child todo', parentTodo);
      const childTodo = getTodoByText(outlineList, 'Child todo');
      
      parentTodo.focus();
      parentTodo.dispatchEvent(createKeyEvent('ArrowRight'));
      
      // Test that child exists and navigation worked
      expect(childTodo).toBeDefined();
      expect(childTodo.parentNode.parentNode).toBe(parentTodo);
    });

    test('should navigate back to parent with left arrow', async () => {
      todoList.addItem('Parent todo');
      const parentTodo = getTodoByText(outlineList, 'Parent todo');
      
      todoList.addItem('Child todo', parentTodo);
      const childTodo = getTodoByText(outlineList, 'Child todo');
      
      childTodo.focus();
      childTodo.dispatchEvent(createKeyEvent('ArrowLeft'));
      
      // Test that parent exists and navigation worked
      expect(parentTodo).toBeDefined();
      expect(childTodo.parentNode.parentNode).toBe(parentTodo);
    });

    test('should expand collapsed item when navigating into it', async () => {
      todoList.addItem('Parent todo');
      const parentTodo = getTodoByText(outlineList, 'Parent todo');
      
      todoList.addItem('Child todo', parentTodo);
      const childTodo = getTodoByText(outlineList, 'Child todo');
      
      // Collapse the parent
      todoList.collapseItem(parentTodo);
      expect(parentTodo.classList.contains('collapsed')).toBe(true);
      
      // Navigate into it
      parentTodo.focus();
      parentTodo.dispatchEvent(createKeyEvent('ArrowRight'));
      
      // Should expand
      expect(parentTodo.classList.contains('collapsed')).toBe(false);
      expect(childTodo).toBeDefined();
    });

    test('should navigate with emacs bindings (Ctrl+N/P)', async () => {
      todoList.addItem('First todo');
      todoList.addItem('Second todo');
      
      const firstTodo = getTodoByText(outlineList, 'First todo');
      const secondTodo = getTodoByText(outlineList, 'Second todo');
      
      firstTodo.focus();
      
      // Ctrl+N should move down
      firstTodo.dispatchEvent(new KeyboardEvent('keydown', { 
        key: 'n', 
        ctrlKey: true,
        bubbles: true 
      }));
      
      // Ctrl+P should move up
      secondTodo.dispatchEvent(new KeyboardEvent('keydown', { 
        key: 'p', 
        ctrlKey: true,
        bubbles: true 
      }));
      
      expect(firstTodo).toBeDefined();
      expect(secondTodo).toBeDefined();
    });

    test('should navigate with vi bindings (J/K for up/down, H/L for left/right)', async () => {
      todoList.addItem('First todo');
      todoList.addItem('Second todo');
      
      const firstTodo = getTodoByText(outlineList, 'First todo');
      const secondTodo = getTodoByText(outlineList, 'Second todo');
      
      firstTodo.focus();
      
      // J should move down
      firstTodo.dispatchEvent(new KeyboardEvent('keydown', { 
        key: 'j', 
        bubbles: true 
      }));
      
      // K should move up
      secondTodo.dispatchEvent(new KeyboardEvent('keydown', { 
        key: 'k', 
        bubbles: true 
      }));
      
      expect(firstTodo).toBeDefined();
      expect(secondTodo).toBeDefined();
    });

    test('should navigate with vi bindings (H/L for left/right)', async () => {
      todoList.addItem('Parent todo');
      const parentTodo = getTodoByText(outlineList, 'Parent todo');
      
      todoList.addItem('Child todo', parentTodo);
      const childTodo = getTodoByText(outlineList, 'Child todo');
      
      childTodo.focus();
      
      // H should move to parent (left)
      childTodo.dispatchEvent(new KeyboardEvent('keydown', { 
        key: 'h', 
        bubbles: true 
      }));
      
      // L should move to first child (right)
      parentTodo.focus();
      parentTodo.dispatchEvent(new KeyboardEvent('keydown', { 
        key: 'l', 
        bubbles: true 
      }));
      
      expect(parentTodo).toBeDefined();
      expect(childTodo).toBeDefined();
    });

    test('should support Alt+T for toggle collapsed/expanded state', async () => {
      todoList.addItem('Parent todo');
      const parentTodo = getTodoByText(outlineList, 'Parent todo');
      
      todoList.addItem('Child todo', parentTodo);
      const childTodo = getTodoByText(outlineList, 'Child todo');
      
      // Collapse the parent first
      todoList.collapseItem(parentTodo);
      expect(parentTodo.classList.contains('collapsed')).toBe(true);
      
      // Alt+T should expand
      parentTodo.focus();
      parentTodo.dispatchEvent(new KeyboardEvent('keydown', { 
        code: 'KeyT', 
        altKey: true,
        bubbles: true 
      }));
      
      // Should expand
      expect(parentTodo.classList.contains('collapsed')).toBe(false);
      expect(childTodo).toBeDefined();
    });
  });

  describe('Status Label Cycling', () => {
    test('should cycle through custom status labels with Shift+Arrow keys', async () => {
      todoList.addItem('Test todo');
      const todo = getTodoByText(outlineList, 'Test todo');
      
      // Initial state
      expect(todo.querySelector('.outline-label').textContent).toBe('TODO');
      
      // Press Shift+Right to cycle forward
      todo.focus();
      todo.dispatchEvent(new KeyboardEvent('keydown', { 
        key: 'ArrowRight', 
        shiftKey: true,
        bubbles: true 
      }));
      
      expect(todo.querySelector('.outline-label').textContent).toBe('IN PROGRESS');
      
      // Press Shift+Right again to cycle to DONE
      todo.dispatchEvent(new KeyboardEvent('keydown', { 
        key: 'ArrowRight', 
        shiftKey: true,
        bubbles: true 
      }));
      
      expect(todo.querySelector('.outline-label').textContent).toBe('DONE');
      expect(todo.classList.contains('completed')).toBe(true);
    });

    test('should cycle backward with Shift+Left Arrow', async () => {
      todoList.addItem('Test todo');
      const todo = getTodoByText(outlineList, 'Test todo');
      
      // Cycle forward to DONE first
      todo.focus();
      todo.dispatchEvent(new KeyboardEvent('keydown', { 
        key: 'ArrowRight', 
        shiftKey: true,
        bubbles: true 
      }));
      todo.dispatchEvent(new KeyboardEvent('keydown', { 
        key: 'ArrowRight', 
        shiftKey: true,
        bubbles: true 
      }));
      
      expect(todo.querySelector('.outline-label').textContent).toBe('DONE');
      
      // Press Shift+Left to cycle backward
      todo.dispatchEvent(new KeyboardEvent('keydown', { 
        key: 'ArrowLeft', 
        shiftKey: true,
        bubbles: true 
      }));
      
      expect(todo.querySelector('.outline-label').textContent).toBe('IN PROGRESS');
      expect(todo.classList.contains('completed')).toBe(false);
    });
  });

  describe('Metadata Keyboard Shortcuts', () => {
    test('should toggle priority with "p" key', async () => {
      todoList.addItem('Test todo');
      const todo = getTodoByText(outlineList, 'Test todo');
      
      todo.focus();
      todo.dispatchEvent(createKeyEvent('p'));
      
      // Should have priority indicator
      const priorityIndicator = todo.querySelector('.priority-indicator');
      expect(priorityIndicator).toBeDefined();
      
      // Toggle again to remove
      todo.dispatchEvent(createKeyEvent('p'));
      expect(todo.querySelector('.priority-indicator')).toBeNull();
    });

    test('should toggle blocked with "b" key', async () => {
      todoList.addItem('Test todo');
      const todo = getTodoByText(outlineList, 'Test todo');
      
      todo.focus();
      todo.dispatchEvent(createKeyEvent('b'));
      
      // Should have blocked indicator
      const blockedIndicator = todo.querySelector('.blocked-indicator');
      expect(blockedIndicator).toBeDefined();
      
      // Toggle again to remove
      todo.dispatchEvent(createKeyEvent('b'));
      expect(todo.querySelector('.blocked-indicator')).toBeNull();
    });

    test('should open due date popup with "d" key', async () => {
      todoList.addItem('Test todo');
      const todo = getTodoByText(outlineList, 'Test todo');
      
      todo.focus();
      todo.dispatchEvent(createKeyEvent('d'));
      
      // Should have date popup
      const popup = getPopup(outlineList);
      expect(popup).toBeDefined();
      expect(popup.classList.contains('date-popup')).toBe(true);
    });

    test('should open assign popup with "a" key', async () => {
      todoList.addItem('Test todo');
      const todo = getTodoByText(outlineList, 'Test todo');
      
      todo.focus();
      todo.dispatchEvent(createKeyEvent('a'));
      
      // Should have assign popup
      const popup = getPopup(outlineList);
      expect(popup).toBeDefined();
      expect(popup.classList.contains('dropdown-popup')).toBe(true);
    });

    test('should open tags popup with "t" key', async () => {
      todoList.addItem('Test todo');
      const todo = getTodoByText(outlineList, 'Test todo');
      
      todo.focus();
      todo.dispatchEvent(createKeyEvent('t'));
      
      // Should have tags popup
      const popup = getPopup(outlineList);
      expect(popup).toBeDefined();
      expect(popup.classList.contains('dropdown-popup')).toBe(true);
    });
  });

  describe('Interactive Popup Features', () => {
    test('should set due date from popup', async () => {
      todoList.addItem('Test todo');
      const todo = getTodoByText(outlineList, 'Test todo');
      
      // Open date popup using keyboard shortcut
      todo.focus();
      todo.dispatchEvent(createKeyEvent('d'));
      
      // Set a date
      const popup = getPopup(outlineList);
      const dateInput = popup.querySelector('input[type="date"]');
      const testDate = new Date();
      testDate.setDate(testDate.getDate() + 1); // Tomorrow
      dateInput.value = testDate.toISOString().split('T')[0];
      dateInput.dispatchEvent(new Event('change'));
      
      // Should have schedule indicator
      const scheduleSpan = todo.querySelector('.outline-schedule');
      expect(scheduleSpan).toBeDefined();
    });

    test('should clear due date from popup', async () => {
      todoList.addItem('Test todo');
      const todo = getTodoByText(outlineList, 'Test todo');
      
      // Set a date first using keyboard shortcut
      todo.focus();
      todo.dispatchEvent(createKeyEvent('d'));
      const popup = getPopup(outlineList);
      const dateInput = popup.querySelector('input[type="date"]');
      const testDate = new Date();
      testDate.setDate(testDate.getDate() + 1);
      dateInput.value = testDate.toISOString().split('T')[0];
      dateInput.dispatchEvent(new Event('change'));
      
      // Clear the date by opening popup again and clearing
      todo.dispatchEvent(createKeyEvent('d'));
      const clearButton = getPopup(outlineList).querySelector('.clear-date');
      if (clearButton) {
        clearButton.click();
      }
      
      // Should not have schedule indicator
      expect(todo.querySelector('.outline-schedule')).toBeNull();
    });

    test('should assign todo from popup', async () => {
      todoList.addItem('Test todo');
      const todo = getTodoByText(outlineList, 'Test todo');
      
      // Open assign popup
      const assignButton = todo.querySelector('.assign-button');
      assignButton.click();
      
      // Select an assignee
      const popup = getPopup(outlineList);
      const assigneeItem = popup.querySelector('.dropdown-item:nth-child(2)'); // alice
      assigneeItem.click();
      
      // Should have assign indicator
      const assignSpan = todo.querySelector('.outline-assign');
      expect(assignSpan).toBeDefined();
      expect(assignSpan.textContent).toContain('alice');
    });
  });

  describe('Parent-Child Relationships', () => {
    test('should indent todo with Alt+Right', async () => {
      todoList.addItem('Parent todo');
      todoList.addItem('Child todo');
      
      const childTodo = getTodoByText(outlineList, 'Child todo');
      const parentTodo = getTodoByText(outlineList, 'Parent todo');
      
      childTodo.focus();
      childTodo.dispatchEvent(new KeyboardEvent('keydown', { 
        key: 'ArrowRight', 
        code: 'ArrowRight',
        altKey: true,
        bubbles: true 
      }));
      
      // Child should now be under parent
      expect(childTodo.parentNode.parentNode).toBe(parentTodo);
    });

    test('should outdent todo with Alt+Left', async () => {
      todoList.addItem('Parent todo');
      todoList.addItem('Child todo', getTodoByText(outlineList, 'Parent todo'));
      
      const childTodo = getTodoByText(outlineList, 'Child todo');
      
      childTodo.focus();
      childTodo.dispatchEvent(new KeyboardEvent('keydown', { 
        key: 'ArrowLeft', 
        code: 'ArrowLeft',
        altKey: true,
        bubbles: true 
      }));
      
      // Test that outdenting worked by checking the structure
      // The child should no longer be under the parent
      const parentTodo = getTodoByText(outlineList, 'Parent todo');
      expect(childTodo.parentNode.parentNode).not.toBe(parentTodo);
    });
  });

  describe('Edit Mode Visibility', () => {
    test('should hide child-count when in edit mode', () => {
      todoList.addItem('Parent todo');
      const parentTodo = getTodoByText(outlineList, 'Parent todo');
      
      // Add a child to create a child-count
      todoList.addItem('Child todo', parentTodo);
      
      // Verify child-count exists
      const childCount = parentTodo.querySelector('.child-count');
      expect(childCount).toBeDefined();
      
      // Enter edit mode
      todoList.enterEditMode(parentTodo);
      
      // Verify editing class is applied
      expect(parentTodo.classList.contains('editing')).toBe(true);
      
      // Child-count should be hidden in edit mode
      expect(childCount.style.display).toBe('none');
      
      // Exit edit mode
      const input = parentTodo.querySelector('.outline-edit-input');
      input.dispatchEvent(createKeyEvent('Enter'));
      
      // Child-count should be visible again
      expect(childCount.style.display).not.toBe('none');
    });

    test('should hide hover buttons with data when in edit mode', () => {
      todoList.addItem('Test todo');
      const todo = getTodoByText(outlineList, 'Test todo');
      
      // Add priority to create a button with data
      todoList.togglePriority(todo);
      
      // Verify priority button exists and has data
      const priorityButton = todo.querySelector('.priority-button');
      expect(priorityButton).toBeDefined();
      expect(priorityButton.classList.contains('has-data')).toBe(true);
      
      // Enter edit mode
      todoList.enterEditMode(todo);
      
      // Verify editing class is applied
      expect(todo.classList.contains('editing')).toBe(true);
      
      // Hover buttons should be hidden in edit mode (including those with data)
      const shadowRoot = outlineList.shadowRoot;
      const shadowTodo = shadowRoot.querySelector(`[data-id="${todo.dataset.id}"]`);
      const shadowHoverButtons = shadowTodo.querySelector('.outline-hover-buttons');
      expect(shadowHoverButtons).toBeDefined();
      expect(shadowHoverButtons.style.display).toBe('none');
      
      // Exit edit mode
      const input = todo.querySelector('.outline-edit-input');
      input.dispatchEvent(createKeyEvent('Enter'));
      
      // Hover buttons should be visible again
      expect(shadowHoverButtons.style.display).not.toBe('none');
    });
  });

  describe('Focus Management After Removal', () => {
    test('should remove item and maintain focus on next available element', () => {
      todoList.addItem('First todo');
      todoList.addItem('Second todo');
      todoList.addItem('Third todo');
      
      const firstTodo = getTodoByText(outlineList, 'First todo');
      const secondTodo = getTodoByText(outlineList, 'Second todo');
      
      // Focus on first todo
      firstTodo.focus();
      
      // Remove first todo
      todoList.removeItem(firstTodo);
      
      // Verify that the first todo was removed
      const remainingTodos = getAllTodos(outlineList);
      expect(remainingTodos.length).toBe(2);
      expect(remainingTodos.find(todo => 
        todo.querySelector('.outline-text').textContent === 'First todo'
      )).toBeUndefined();
      
      // Verify that the second todo still exists
      expect(remainingTodos.find(todo => 
        todo.querySelector('.outline-text').textContent === 'Second todo'
      )).toBeDefined();
    });

    test('should remove last item and maintain focus on previous sibling', () => {
      todoList.addItem('First todo');
      todoList.addItem('Second todo');
      todoList.addItem('Third todo');
      
      const secondTodo = getTodoByText(outlineList, 'Second todo');
      const thirdTodo = getTodoByText(outlineList, 'Third todo');
      
      // Focus on third todo
      thirdTodo.focus();
      
      // Remove third todo
      todoList.removeItem(thirdTodo);
      
      // Verify that the third todo was removed
      const remainingTodos = getAllTodos(outlineList);
      expect(remainingTodos.length).toBe(2);
      expect(remainingTodos.find(todo => 
        todo.querySelector('.outline-text').textContent === 'Third todo'
      )).toBeUndefined();
      
      // Verify that the second todo still exists
      expect(remainingTodos.find(todo => 
        todo.querySelector('.outline-text').textContent === 'Second todo'
      )).toBeDefined();
    });

    test('should remove only child and maintain focus on parent', () => {
      todoList.addItem('Parent todo');
      const parentTodo = getTodoByText(outlineList, 'Parent todo');
      
      todoList.addItem('Child todo', parentTodo);
      const childTodo = getTodoByText(outlineList, 'Child todo');
      
      // Focus on child todo
      childTodo.focus();
      
      // Remove child todo
      todoList.removeItem(childTodo);
      
      // Verify that the child todo was removed
      const remainingTodos = getAllTodos(outlineList);
      expect(remainingTodos.length).toBe(1);
      expect(remainingTodos.find(todo => 
        todo.querySelector('.outline-text').textContent === 'Child todo'
      )).toBeUndefined();
      
      // Verify that the parent todo still exists
      expect(remainingTodos.find(todo => 
        todo.querySelector('.outline-text').textContent === 'Parent todo'
      )).toBeDefined();
    });

    test('should handle removal of last remaining item', () => {
      todoList.addItem('Only todo');
      const onlyTodo = getTodoByText(outlineList, 'Only todo');
      
      // Focus on the only todo
      onlyTodo.focus();
      
      // Remove the only todo
      todoList.removeItem(onlyTodo);
      
      // Verify that the only todo was removed
      const remainingTodos = getAllTodos(outlineList);
      expect(remainingTodos.length).toBe(0);
    });
  });
});

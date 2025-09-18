// Test file for emacs and vi keyboard navigation features
// This tests both navigation and item movement functionality

describe('Keyboard Navigation Features', () => {
  let todoList;
  let outlineList;
  let container;

  beforeEach(async () => {
    // Use the existing test infrastructure
    const testSetup = await createTestOutlineList();
    todoList = testSetup.todoList;
    outlineList = testSetup.outlineList;
    container = testSetup.container;
    
    // Add test data to the outline
    todoList.addItem("Item 1");
    todoList.addItem("Item 2");
    todoList.addItem("Item 3");
    
    // Add a child to the first item
    const firstItem = getAllTodos(outlineList)[0];
    todoList.addItem("Item 1.1", firstItem);
    todoList.addItem("Item 1.2", firstItem);
  });

  afterEach(() => {
    cleanupTestOutlineList(container);
  });

  describe('Emacs Navigation Bindings (Ctrl+N/P/F/B)', () => {
    test('Ctrl+N should navigate to next sibling', () => {
      const todos = getAllTodos(outlineList);
      const firstItem = todos[0];
      firstItem.focus();
      
      const event = createKeyEvent('n', { ctrlKey: true });
      firstItem.dispatchEvent(event);
      
      // Should focus on the next sibling
      expect(getActiveElement(outlineList)).toBe(todos[1]);
    });

    test('Ctrl+P should navigate to previous sibling', () => {
      const todos = getAllTodos(outlineList);
      const secondItem = todos[1];
      secondItem.focus();
      
      const event = createKeyEvent('p', { ctrlKey: true });
      secondItem.dispatchEvent(event);
      
      // Should focus on the previous sibling
      expect(getActiveElement(outlineList)).toBe(todos[0]);
    });

    test('Ctrl+F should navigate into first child', () => {
      const todos = getAllTodos(outlineList);
      const firstItem = todos[0];
      firstItem.focus();
      
      const event = createKeyEvent('f', { ctrlKey: true });
      firstItem.dispatchEvent(event);
      
      // Should focus on the first child
      const childItem = firstItem.querySelector('ul li');
      expect(getActiveElement(outlineList)).toBe(childItem);
    });

    test('Ctrl+B should navigate to parent', () => {
      const todos = getAllTodos(outlineList);
      const firstItem = todos[0];
      const childItem = firstItem.querySelector('ul li');
      childItem.focus();
      
      const event = createKeyEvent('b', { ctrlKey: true });
      childItem.dispatchEvent(event);
      
      // Should focus on the parent
      expect(getActiveElement(outlineList)).toBe(firstItem);
    });
  });

  describe('Vi Navigation Bindings (/J/K/L)', () => {
    test('J should navigate to next sibling', () => {
      const todos = getAllTodos(outlineList);
      const firstItem = todos[0];
      firstItem.focus();
      
      const event = createKeyEvent('j');
      firstItem.dispatchEvent(event);
      
      // Should focus on the next sibling
      expect(getActiveElement(outlineList)).toBe(todos[1]);
    });

    test('K should navigate to previous sibling', () => {
      const todos = getAllTodos(outlineList);
      const secondItem = todos[1];
      secondItem.focus();
      
      const event = createKeyEvent('k');
      secondItem.dispatchEvent(event);
      
      // Should focus on the next sibling
      expect(getActiveElement(outlineList)).toBe(todos[0]);
    });

    test('L should navigate into first child', () => {
      const todos = getAllTodos(outlineList);
      const firstItem = todos[0];
      firstItem.focus();
      
      const event = createKeyEvent('l');
      firstItem.dispatchEvent(event);
      
      // Should focus on the first child
      const childItem = firstItem.querySelector('ul li');
      expect(getActiveElement(outlineList)).toBe(childItem);
    });    
  });

  describe('Item Movement Shortcuts', () => {
    describe('Move Down (Alt+N, Alt+J, Alt+ArrowDown)', () => {
      test('Alt+N should move item down (emacs style)', () => {
        const todos = getAllTodos(outlineList);
        const firstItem = todos[0];
        firstItem.focus();
        
        const event = createKeyEvent('n', { altKey: true });
        firstItem.dispatchEvent(event);
        
        // Item should be moved down in the list
        const updatedTodos = getAllTodos(outlineList);
        expect(updatedTodos[1]).toBe(firstItem);
      });

      test('Alt+J should move item down (vi style)', () => {
        const todos = getAllTodos(outlineList);
        const firstItem = todos[0];
        firstItem.focus();
        
        const event = createKeyEvent('j', { altKey: true });
        firstItem.dispatchEvent(event);
        
        // Item should be moved down in the list
        const updatedTodos = getAllTodos(outlineList);
        expect(updatedTodos[1]).toBe(firstItem);
      });

      test('Alt+ArrowDown should move item down (arrow style)', () => {
        const todos = getAllTodos(outlineList);
        const firstItem = todos[0];
        firstItem.focus();
        
        const event = createKeyEvent('ArrowDown', { altKey: true });
        firstItem.dispatchEvent(event);
        
        // Item should be moved down in the list
        const updatedTodos = getAllTodos(outlineList);
        expect(updatedTodos[1]).toBe(firstItem);
      });
    });

    describe('Move Up (Alt+P, Alt+K, Alt+ArrowUp)', () => {
      test('Alt+P should move item up (emacs style)', () => {
        // First, let's verify the test setup is working
        const todos = getAllTodos(outlineList);
        expect(todos.length).toBeGreaterThan(1);
        
        // Check that we have the expected items
        const firstItemText = todos[0].querySelector('.outline-text')?.textContent;
        const secondItemText = todos[1].querySelector('.outline-text')?.textContent;
        
        console.log('Test setup verification:');
        console.log('- First item:', firstItemText);
        console.log('- Second item:', secondItemText);
        console.log('- Total items:', todos.length);
        
        // Verify the second item exists and can be focused
        const secondItem = todos[1];
        expect(secondItem).toBeDefined();
        expect(secondItem.querySelector('.outline-text')).toBeDefined();
        
        // Focus the second item
        console.log('About to focus secondItem:', secondItem);
        console.log('Second item properties:', {
          tagName: secondItem.tagName,
          textContent: secondItem.querySelector('.outline-text')?.textContent,
          tabIndex: secondItem.tabIndex,
          hasFocus: secondItem === document.activeElement
        });
        
        secondItem.focus();
        
        console.log('After focus():');
        console.log('- document.activeElement:', document.activeElement);
        console.log('- secondItem:', secondItem);
        console.log('- Are they equal?', document.activeElement === secondItem);
        
        expect(getActiveElement(outlineList)).toBe(secondItem);
        
        // Create and dispatch the Alt+P event
        const event = createKeyEvent('p', { altKey: true });
        secondItem.dispatchEvent(event);
        
        // Check if the item was moved
        const updatedTodos = getAllTodos(outlineList);
        console.log('After Alt+P:');
        console.log('- Items:', updatedTodos.map(t => t.querySelector('.outline-text')?.textContent));
        console.log('- Second item still at position 1?', updatedTodos[1] === secondItem);
        console.log('- Second item moved to position 0?', updatedTodos[0] === secondItem);
        
        // The item should be moved up
        expect(updatedTodos[0]).toBe(secondItem);
      });

      test('Alt+K should move item up (vi style)', () => {
        const todos = getAllTodos(outlineList);
        const secondItem = todos[1];
        secondItem.focus();
        
        const event = createKeyEvent('k', { altKey: true });
        secondItem.dispatchEvent(event);
        
        // Item should be moved up in the list
        const updatedTodos = getAllTodos(outlineList);
        expect(updatedTodos[0]).toBe(secondItem);
      });

      test('Alt+ArrowUp should move item up (arrow style)', () => {
        const todos = getAllTodos(outlineList);
        const secondItem = todos[1];
        secondItem.focus();
        
        const event = createKeyEvent('ArrowUp', { altKey: true });
        secondItem.dispatchEvent(event);
        
        // Item should be moved up in the list
        const updatedTodos = getAllTodos(outlineList);
        expect(updatedTodos[0]).toBe(secondItem);
      });
    });

    describe('Indent (Alt+F, Alt+L, Alt+ArrowRight)', () => {
      test('Alt+F should indent item (emacs style)', () => {
        const todos = getAllTodos(outlineList);
        const secondItem = todos[1];
        secondItem.focus();
        
        const event = createKeyEvent('f', { altKey: true });
        secondItem.dispatchEvent(event);
        
        // Item should be indented (moved as child of first item)
        const updatedTodos = getAllTodos(outlineList);
        const firstItem = updatedTodos[0];
        const sublist = firstItem.querySelector("ul");
        expect(sublist.children).toContain(secondItem);
      });

      test('Alt+L should indent item (vi style)', () => {
        const todos = getAllTodos(outlineList);
        const firstItem = todos[0];
        const secondItem = todos[1];
        secondItem.focus();
        
        const event = createKeyEvent('l', { altKey: true });
        secondItem.dispatchEvent(event);
        
        // Item should be indented (moved as child of first item)
        const updatedTodos = getAllTodos(outlineList);
        const firstItemUpdated = updatedTodos[0];
        const sublist = firstItemUpdated.querySelector("ul");
        expect(sublist.children).toContain(secondItem);
      });

      test('Alt+ArrowRight should indent item (arrow style)', () => {
        const todos = getAllTodos(outlineList);
        const secondItem = todos[1];
        secondItem.focus();
        
        const event = createKeyEvent('ArrowRight', { altKey: true });
        secondItem.dispatchEvent(event);
        
        // Item should be indented (moved as child of first item)
        const updatedTodos = getAllTodos(outlineList);
        const firstItem = updatedTodos[0];
        const sublist = firstItem.querySelector("ul");
        expect(sublist.children).toContain(secondItem);
      });
    });

    describe('Outdent (Alt+B, Alt+H, Alt+ArrowLeft)', () => {
      test('Alt+B should outdent item (emacs style)', () => {
        const todos = getAllTodos(outlineList);
        const firstItem = todos[0];
        const childItem = firstItem.querySelector('ul li');
        childItem.focus();
        
        const event = createKeyEvent('b', { altKey: true });
        childItem.dispatchEvent(event);
        
        // Item should be outdented (moved to root level)
        const updatedTodos = getAllTodos(outlineList);
        expect(updatedTodos).toContain(childItem);
      });

      test('Alt+H should outdent item (vi style)', () => {
        const todos = getAllTodos(outlineList);
        const firstItem = todos[0];
        const childItem = firstItem.querySelector('ul li');
        childItem.focus();
        
        const event = createKeyEvent('h', { altKey: true });
        childItem.dispatchEvent(event);
        
        // Item should be outdented (moved to root level)
        const updatedTodos = getAllTodos(outlineList);
        expect(updatedTodos).toContain(childItem);
      });

      test('Alt+ArrowLeft should outdent item (arrow style)', () => {
        const todos = getAllTodos(outlineList);
        const firstItem = todos[0];
        const childItem = firstItem.querySelector('ul li');
        childItem.focus();
        
        const event = createKeyEvent('ArrowLeft', { altKey: true });
        childItem.dispatchEvent(event);
        
        // Item should be outdented (moved to root level)
        const updatedTodos = getAllTodos(outlineList);
        expect(updatedTodos).toContain(childItem);
      });
    });
  });

  describe('Edge Cases', () => {
    test('Navigation at boundaries should work correctly', () => {
      const todos = getAllTodos(outlineList);
      const firstItem = todos[0];
      firstItem.focus();
      
      // Try to go up from first item
      const upEvent = createKeyEvent('k');
      firstItem.dispatchEvent(upEvent);
      
      // Should stay on first item (no parent)
      expect(getActiveElement(outlineList)).toBe(firstItem);
      
      // Try to go left from first item
      const leftEvent = createKeyEvent('h');
      firstItem.dispatchEvent(leftEvent);
      
      // Should stay on first item (no parent)
      expect(getActiveElement(outlineList)).toBe(firstItem);
    });

    test('Movement at boundaries should work correctly', () => {
      const todos = getAllTodos(outlineList);
      const firstItem = todos[0];
      firstItem.focus();
      
      // Try to move up from first item
      const upEvent = createKeyEvent('p', { altKey: true });
      firstItem.dispatchEvent(upEvent);
      
      // Should stay in place (can't move up from first position)
      const updatedTodos = getAllTodos(outlineList);
      expect(updatedTodos[0]).toBe(firstItem);
      
      const lastItem = updatedTodos[updatedTodos.length - 1];
      lastItem.focus();
      
      // Try to move down from last item
      const downEvent = createKeyEvent('n', { altKey: true });
      lastItem.dispatchEvent(downEvent);
      
      // Should stay in place (can't move down from last position)
      const finalTodos = getAllTodos(outlineList);
      expect(finalTodos[finalTodos.length - 1]).toBe(lastItem);
    });
  });
});

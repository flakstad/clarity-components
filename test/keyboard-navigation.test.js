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
      expect(document.activeElement).toBe(todos[1]);
    });

    test('Ctrl+P should navigate to previous sibling', () => {
      const todos = getAllTodos(outlineList);
      const secondItem = todos[1];
      secondItem.focus();
      
      const event = createKeyEvent('p', { ctrlKey: true });
      secondItem.dispatchEvent(event);
      
      // Should focus on the previous sibling
      expect(document.activeElement).toBe(todos[0]);
    });

    test('Ctrl+F should navigate into first child', () => {
      const todos = getAllTodos(outlineList);
      const firstItem = todos[0];
      firstItem.focus();
      
      const event = createKeyEvent('f', { ctrlKey: true });
      firstItem.dispatchEvent(event);
      
      // Should focus on the first child
      const childItem = firstItem.querySelector('ul li');
      expect(document.activeElement).toBe(childItem);
    });

    test('Ctrl+B should navigate to parent', () => {
      const todos = getAllTodos(outlineList);
      const firstItem = todos[0];
      const childItem = firstItem.querySelector('ul li');
      childItem.focus();
      
      const event = createKeyEvent('b', { ctrlKey: true });
      childItem.dispatchEvent(event);
      
      // Should focus on the parent
      expect(document.activeElement).toBe(firstItem);
    });
  });

  describe('Vi Navigation Bindings (H/J/K/L)', () => {
    test('J should navigate to next sibling', () => {
      const todos = getAllTodos(outlineList);
      const firstItem = todos[0];
      firstItem.focus();
      
      const event = createKeyEvent('j');
      firstItem.dispatchEvent(event);
      
      // Should focus on the next sibling
      expect(document.activeElement).toBe(todos[1]);
    });

    test('K should navigate to previous sibling', () => {
      const todos = getAllTodos(outlineList);
      const secondItem = todos[1];
      secondItem.focus();
      
      const event = createKeyEvent('k');
      secondItem.dispatchEvent(event);
      
      // Should focus on the previous sibling
      expect(document.activeElement).toBe(todos[0]);
    });

    test('L should navigate into first child', () => {
      const todos = getAllTodos(outlineList);
      const firstItem = todos[0];
      firstItem.focus();
      
      const event = createKeyEvent('l');
      firstItem.dispatchEvent(event);
      
      // Should focus on the first child
      const childItem = firstItem.querySelector('ul li');
      expect(document.activeElement).toBe(childItem);
    });

    test('H should navigate to parent', () => {
      const todos = getAllTodos(outlineList);
      const firstItem = todos[0];
      const childItem = firstItem.querySelector('ul li');
      childItem.focus();
      
      const event = createKeyEvent('h');
      childItem.dispatchEvent(event);
      
      // Should focus on the parent
      expect(document.activeElement).toBe(firstItem);
    });
  });

  describe('Item Movement Shortcuts', () => {
    test('Alt+N should move item down', () => {
      const todos = getAllTodos(outlineList);
      const firstItem = todos[0];
      firstItem.focus();
      
      const event = createKeyEvent('n', { altKey: true });
      firstItem.dispatchEvent(event);
      
      // Item should be moved down in the list
      const updatedTodos = getAllTodos(outlineList);
      expect(updatedTodos[1]).toBe(firstItem);
    });

    test('Alt+P should move item up', () => {
      const todos = getAllTodos(outlineList);
      const secondItem = todos[1];
      secondItem.focus();
      
      const event = createKeyEvent('p', { altKey: true });
      secondItem.dispatchEvent(event);
      
      // Item should be moved up in the list
      const updatedTodos = getAllTodos(outlineList);
      expect(updatedTodos[0]).toBe(secondItem);
    });

    test('Alt+F should indent item', () => {
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

    test('Alt+B should outdent item', () => {
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

    test('Alt+L should indent item (vi style)', () => {
      const todos = getAllTodos(outlineList);
      const secondItem = todos[1];
      secondItem.focus();
      
      const event = createKeyEvent('l', { altKey: true });
      secondItem.dispatchEvent(event);
      
      // Item should be indented (moved as child of first item)
      const updatedTodos = getAllTodos(outlineList);
      const firstItem = updatedTodos[0];
      const sublist = firstItem.querySelector("ul");
      expect(sublist.children).toContain(secondItem);
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
      expect(document.activeElement).toBe(firstItem);
      
      // Try to go left from first item
      const leftEvent = createKeyEvent('h');
      firstItem.dispatchEvent(leftEvent);
      
      // Should stay on first item (no parent)
      expect(document.activeElement).toBe(firstItem);
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

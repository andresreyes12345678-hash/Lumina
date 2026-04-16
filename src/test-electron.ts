// Test file to verify electronAPI is available
console.log('=== ELECTRON API TEST ===');
console.log('window.electronAPI exists:', !!window.electronAPI);

if (window.electronAPI) {
    console.log('✓ electronAPI available');
    console.log('✓ triggerSlide:', typeof window.electronAPI.triggerSlide);
    console.log('✓ onUpdatePreview:', typeof window.electronAPI.onUpdatePreview);
    console.log('✓ onUpdateStage:', typeof window.electronAPI.onUpdateStage);

    // Test trigger
    window.electronAPI.triggerSlide({ content: 'TEST MESSAGE', id: 'test', type: 'text', fontSize: 100, fontFamily: 'Arial' } as any);
    console.log('✓ Test trigger sent');
} else {
    console.error('✗  electronAPI NOT AVAILABLE');
    console.error('✗ This is likely a preload.js issue');
}

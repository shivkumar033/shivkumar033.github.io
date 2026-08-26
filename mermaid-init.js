document.addEventListener("DOMContentLoaded", function () {
    // Zola puts data-lang on the <code> element, not the <pre>
    var codeBlocks = document.querySelectorAll("code[data-lang='mermaid']");
    
    if (codeBlocks.length === 0) return;

    codeBlocks.forEach(function(code) {
        var pre = code.parentElement; // the <pre> wrapper
        var mermaidDiv = document.createElement('div');
        mermaidDiv.className = 'mermaid';
        mermaidDiv.style.cssText = 'background: #1e1e2e; border-radius: 12px; padding: 24px; display: flex; justify-content: center;';
        mermaidDiv.textContent = code.textContent;

        // Check if copy-button.js wrapped it in a .pre-container
        var container = pre.closest('.pre-container');
        if (container) {
            container.replaceWith(mermaidDiv);
        } else {
            pre.replaceWith(mermaidDiv);
        }
    });

    mermaid.initialize({ startOnLoad: false, theme: 'dark' });
    mermaid.init(undefined, document.querySelectorAll('.mermaid'));
});

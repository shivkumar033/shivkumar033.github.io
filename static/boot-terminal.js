(function() {
    const terminal = document.getElementById('boot-terminal');
    if (!terminal) return;
    const lines = [
    "╭──────────────────────────────────────────────╮",
    "│ SECURITY SYSTEM INITIALIZATION v2.4         │",
    "╰──────────────────────────────────────────────╯",
    "",
    "Initializing security workspace...",
    "Loading Linux environment...",
    "Starting security tools...",
    "Loading Burp Suite modules...",
    "Initializing DevSecOps pipeline...",
    "Scanning application attack surface...",
    "Brewing coffee ☕",
    "All systems operational.",
    "",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 100%",
    "",
    "Developer  : Shiv Kumar Yadav",
    "Origin     : Kathmandu, Nepal 🌍",
    "Role       : Cybersecurity | AppSec | DevSecOps",
    "Focus      : Web Application Security",
    "",
    "Skills     : VAPT | OWASP | API Security",
    "Tools      : Burp Suite | ZAP | Nmap | SQLmap",
    "DevSecOps  : Jenkins | Docker | Trivy | Snyk",
    "",
    "Status     : READY_FOR_SECURE_CODE",
    "",
    "awaiting_user_input..."
];
    let currentLine = 0;
    let currentChar = 0;
    function typeLine() {
        if (currentLine >= lines.length) {
            setInterval(function() {
                let text = terminal.textContent;
                if (text.endsWith("█")) {
                    terminal.textContent = text.slice(0, -1) + " ";
                } else {
                    terminal.textContent = text.slice(0, -1) + "█";
                }
            }, 500);
            return;
        }
        let lineText = lines[currentLine];
        let delay = 2;
        if (currentChar === 0 && currentLine > 0) {
            terminal.textContent = terminal.textContent.replace(/█$/, "") + "\n█";
        }
        if (currentChar < lineText.length) {
            let text = terminal.textContent.replace(/█$/, "");
            terminal.textContent = text + lineText[currentChar] + "█";
            currentChar++;
            setTimeout(typeLine, delay);
        } else {
            currentLine++;
            currentChar = 0;
            let lineDelay = 40;
            setTimeout(typeLine, lineDelay);
        }
    }
    terminal.textContent = "█";
    setTimeout(typeLine, 100);
})();

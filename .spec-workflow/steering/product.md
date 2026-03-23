# Product Overview

## Product Purpose
Forge is a network configuration template generator for infrastructure teams. It replaces the workflow of using Cisco DNAC's CLI template "simulation" feature to generate switch/firewall configurations via copy-paste. Forge provides a purpose-built tool for creating, managing, and generating device configurations from templates with variable substitution.

## Target Users
Network engineers and infrastructure teams who:
- Currently use Cisco DNAC CLI templates as a config generation tool (not for deployment)
- Need to generate configurations for multiple device models (switches, firewalls, access points)
- Want to manage reusable templates with variable substitution
- Need to share template libraries across team members without exposing sensitive data
- Work with Cisco IOS, IOS-XE, and potentially other vendor config formats

## Key Features

1. **Model Library**: Add, edit, and remove device models (e.g., IE3300, C9200L, ASA 5525-X). Each model contains one or more template sections with associated variables.
2. **Template Sections**: Configurations split into logical sections — Base, Auth, VLAN, Interface, TACACS/ISE, ACL — each independently editable and copyable.
3. **Variable Detection**: Auto-detect `$variable` and `${variable}` patterns from pasted config text during model creation. Easy variable management UI for adding/editing variables.
4. **Config Generator**: Select a model, fill in variables, see live config preview with syntax highlighting. Copy individual sections or the full config.
5. **Multi-Format Output**: Support Cisco CLI syntax natively, plus XML, JSON, and YAML output formats for different vendor ecosystems and automation pipelines.
6. **Encrypted Export/Import**: `.stvault` encrypted archive format for sharing template libraries. Enables public hosting without exposing private network data (IPs, hostnames, TACACS keys, etc.).
7. **Browser Storage**: All models and configurations stored in browser localStorage. No server, no database, no accounts required.

## Business Objectives

- **Replace DNAC dependency**: Eliminate the need to use Cisco DNAC as a config generation tool
- **Team portability**: `.stvault` encrypted exports allow team members to share template libraries
- **Public hosting safe**: Encryption model means the app can be hosted publicly — no risk of private data exposure
- **Zero infrastructure**: No backend, no database, no authentication — just a static web app
- **Muscle memory transfer**: DNAC-compatible `$variable` syntax so the team's existing knowledge transfers directly

## Success Metrics

- Team stops using DNAC for config generation within 2 weeks of deployment
- Config generation time reduced vs DNAC workflow
- All active device models have templates in Forge
- Template library successfully shared via `.stvault` across team members

## Product Principles

1. **Engineer-First UX**: This is a tool for network engineers. Terminal-style config output, monospace fonts, no unnecessary decoration. Functional over flashy.
2. **Copy-Paste Optimized**: The primary output action is copying config to clipboard. Every design decision should minimize friction for this workflow.
3. **Section Independence**: Each config section (Base, Auth, VLAN, etc.) is independently viewable, editable, and copyable. Engineers rarely need the full config at once.
4. **Safe by Default**: No private data stored unencrypted outside the browser. Exports always encrypted. Public hosting is always safe.
5. **DNAC Compatible**: Variable syntax, section concepts, and workflow patterns should feel familiar to anyone who has used DNAC CLI templates.

## Future Vision

### Potential Enhancements
- **Config diff**: Compare generated configs against a baseline or previous version
- **Config history**: Track previously generated configurations per model
- **Team sync**: Real-time template library sync across team members (requires backend)
- **Config push**: Optional integration with network automation tools (Ansible, Netmiko) for direct deployment
- **Validation**: Syntax validation for Cisco IOS/IOS-XE configurations
- **Config scrub**: Auto-detect and flag potential sensitive data in templates

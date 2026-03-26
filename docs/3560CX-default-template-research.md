# Cisco 3560CX Default Template — Research & Section Breakdown

> Based on lbruton's home 3560CX-12PD-S config, enhanced with Cisco IOS 15.2 best practices for home/small-office deployment.

---

## Proposed Section Breakdown

The original config has been broken into **12 named sections** following Forge's section model. Each section is self-contained and reorderable.

---

### Section 1: System Services

Core platform services and global behaviors.

```ios
!##### System Services - START #####
version 15.2
no service pad
service timestamps debug datetime msec localtime show-timezone year
service timestamps log datetime msec localtime show-timezone year
service password-encryption
security passwords min-length 12
no ip source-route
no ip finger
!##### System Services - END #####
```

**Enhancements over original:**
- Added `localtime show-timezone year` to timestamps for better log correlation
- Added `security passwords min-length 12` (hardening)
- Added `no ip source-route` (prevents source-routed packet attacks)
- Added `no ip finger` (disables finger service)

---

### Section 2: Hostname & Boot

Device identity and boot parameters.

```ios
!##### Hostname & Boot - START #####
hostname $HOSTNAME
!
boot-start-marker
boot-end-marker
!##### Hostname & Boot - END #####
```

---

### Section 3: Authentication

Local user accounts and enable secret. AAA placeholder included for future expansion.

```ios
!##### Authentication - START #####
enable secret 5 ${ENABLE_SECRET}
!
username admin privilege 15 secret 5 ${ADMIN_SECRET}
no aaa new-model
!##### Authentication - END #####
```

---

### Section 4: Platform & Switching

Hardware provisioning, MTU, and VLAN allocation policy.

```ios
!##### Platform & Switching - START #####
switch 1 provision ws-c3560cx-12pd-s
system mtu routing 1500
!
ip routing
!
vlan internal allocation policy ascending
!##### Platform & Switching - END #####
```

---

### Section 5: DNS & Domain

Domain name, DNS resolution, and name servers.

```ios
!##### DNS & Domain - START #####
no ip domain-lookup
ip domain-name $IP_domain_name
ip name-server $IP_dns_address
!##### DNS & Domain - END #####
```

---

### Section 6: NTP & Clock

Time synchronization — critical for log correlation and certificate validation.

```ios
!##### NTP & Clock - START #####
clock timezone $TIMEZONE_NAME $TIMEZONE_OFFSET
clock summer-time $TIMEZONE_DST recurring
!
ntp server $NTP_SERVER_1 prefer
ntp server $NTP_SERVER_2
ntp source Vlan1
!##### NTP & Clock - END #####
```

**Enhancement — NEW section.** Original config had no NTP. Best practices:
- Use 1 or 3+ NTP sources (never exactly 2 — the switch can't break ties)
- Source NTP from the management SVI
- NTP authentication is optional for home lab but recommended if exposed

---

### Section 7: Spanning Tree

STP mode, PortFast, BPDU guard, and loop guard.

```ios
!##### Spanning Tree - START #####
spanning-tree mode rapid-pvst
spanning-tree extend system-id
spanning-tree portfast default
spanning-tree portfast bpduguard default
spanning-tree loopguard default
spanning-tree vlan 1-4094 priority 4096
!##### Spanning Tree - END #####
```

**Enhancements over original:**
- Added `portfast default` — enables PortFast on all non-trunk access ports (faster convergence)
- Added `portfast bpduguard default` — err-disables any access port that receives a BPDU (rogue switch protection)
- Added `loopguard default` — prevents unidirectional link issues on trunk/uplink ports
- Added `priority 4096` — makes this switch the root bridge for all VLANs (home lab = single switch)

---

### Section 8: IP Device Tracking

Tracks connected hosts by IP/MAC binding. Enables visibility into what's connected where.

```ios
!##### IP Device Tracking - START #####
ip device tracking probe count 3
ip device tracking probe interval 30
ip device tracking probe delay 10
ip device tracking probe auto-source override
!##### IP Device Tracking - END #####
```

**Enhancement — NEW section.** Notes:
- On IOS 15.2(1)E+, IPDT activates automatically when dependent features are enabled
- `probe auto-source override` fixes the "0.0.0.0 source ARP" problem on L2-only VLANs
- Per-interface limits are set in the Interface sections (`ip device tracking maximum 4` on access, `maximum 0` on trunks)
- Verify with `show ip device tracking all`

---

### Section 9: Interfaces

VLAN SVIs and physical interface assignments.

```ios
!##### Interfaces - START #####
interface Vlan1
 description LBRUTON.CC
 ip address $VLAN1_address $VLAN1_Subnet
!##### Interfaces - END #####
```

---

### Section 10: Routing & Forwarding

Default gateway, forwarding, and HTTP/SSH settings.

```ios
!##### Routing & Forwarding - START #####
ip default-gateway $IP_default_gateway
ip forward-protocol nd
!
no ip http server
no ip http secure-server
!##### Routing & Forwarding - END #####
```

---

### Section 11: SSH & Remote Access

SSH hardening and VTY line configuration.

```ios
!##### SSH & Remote Access - START #####
ip ssh version 2
ip ssh time-out 60
ip ssh authentication-retries 3
ip ssh logging events
!
ip access-list standard ACL-MGMT
 permit $MGMT_SUBNET $MGMT_WILDCARD
 deny any log
!
line con 0
 exec-timeout 5 0
 logging synchronous
 login local
line vty 0 4
 access-class ACL-MGMT in
 exec-timeout 10 0
 login local
 transport input ssh
 transport output none
line vty 5 15
 access-class ACL-MGMT in
 exec-timeout 10 0
 login local
 transport input ssh
 transport output none
!##### SSH & Remote Access - END #####
```

**Enhancements over original:**
- Added `ip ssh time-out 60` — drops unauthenticated SSH sessions after 60 seconds
- Added `ip ssh authentication-retries 3` — limits brute-force attempts
- Added `ip ssh logging events` — logs SSH connect/disconnect events
- Added `ACL-MGMT` access-class on VTY lines — restricts SSH to management subnet only
- Added `exec-timeout` on console (5 min) and VTY (10 min) — prevents abandoned sessions
- Added `transport output none` — prevents the switch from initiating outbound connections from VTY

**Post-config step:** Generate RSA keys manually after applying:
```
crypto key generate rsa modulus 2048
```

---

### Section 12: Logging

Local buffer and remote syslog configuration.

```ios
!##### Logging - START #####
no logging console
logging buffered 32768 informational
logging console errors
logging monitor informational
!
logging source-interface Vlan1
logging host $SYSLOG_HOST transport udp port $SYSLOG_PORT
logging trap informational
!
archive
 log config
  logging enable
  notify syslog contenttype plaintext
  hidekeys
!##### Logging - END #####
```

**Enhancements over original:**
- Added `logging buffered 32768 informational` — local log buffer (survives terminal disconnect, lost on reboot)
- Added `logging console errors` — reduces console noise (only errors)
- Added `logging monitor informational` — for `terminal monitor` sessions
- Added `logging source-interface Vlan1` — pins syslog source IP to management SVI
- Added `logging trap informational` — sends severity 6+ to remote syslog
- Added `archive log config` block — logs all configuration changes to syslog with `hidekeys` to mask passwords
- Replaced hardcoded syslog IP with `$SYSLOG_HOST` and `$SYSLOG_PORT` variables

---

### Section 13: SNMP

SNMP v3 monitoring with view restrictions.

```ios
!##### SNMP - START #####
snmp-server view MONITOR_VIEW iso included
snmp-server group MONITOR_GROUP v3 priv read MONITOR_VIEW
snmp-server user $SNMPV3_USER MONITOR_GROUP v3 auth sha $SNMPV3_AUTH_PASS priv aes 128 $SNMPV3_PRIV_PASS
!
snmp-server location $SNMP_LOCATION
snmp-server contact $SNMP_CONTACT
!
no snmp-server system-shutdown
!##### SNMP - END #####
```

**Enhancements over original:**
- Upgraded from SNMPv2c community string to **SNMPv3 authPriv** (SHA auth + AES-128 encryption)
- Removed `snmp-server community $SNMPV2_ro RO` — v2c community strings are cleartext on the wire
- Added `no snmp-server system-shutdown` — prevents SNMP-triggered shutdowns
- Variables changed to v3 parameters: `$SNMPV3_USER`, `$SNMPV3_AUTH_PASS`, `$SNMPV3_PRIV_PASS`

**IOS 15.2 caveat:** SHA-256/384/512 auth is NOT available — SHA-1 + AES-128 is the strongest combo on this platform.

**Note:** If SNMPv2c is still needed for legacy NMS compatibility, the original community string config can be kept alongside v3.

---

### Section 14: Banner

Message of the day banner.

```ios
!##### Banner - START #####
banner motd ^C

$MOTD

^C
!##### Banner - END #####
```

---

### Section 15: Errdisable Recovery

Automatic recovery from err-disabled port states. Practical for home lab where manual intervention is inconvenient.

```ios
!##### Errdisable Recovery - START #####
errdisable recovery cause bpduguard
errdisable recovery cause security-violation
errdisable recovery cause storm-control
errdisable recovery cause arp-inspection
errdisable recovery cause dhcp-rate-limit
errdisable recovery cause link-flap
errdisable recovery interval 300
!##### Errdisable Recovery - END #####
```

**Enhancement — NEW section.** Auto-recovers ports that get err-disabled by BPDU guard, storm control, etc. Recovery interval is 300 seconds (5 minutes).

---

## Complete Reassembled Template

All sections in order, wrapped in the Forge START/END markers:

```ios
!##### DEFAULT CONFIGURATION - START #####
!
!##### System Services - START #####
version 15.2
no service pad
service timestamps debug datetime msec localtime show-timezone year
service timestamps log datetime msec localtime show-timezone year
service password-encryption
security passwords min-length 12
no ip source-route
no ip finger
!##### System Services - END #####
!
!##### Hostname & Boot - START #####
hostname $HOSTNAME
!
boot-start-marker
boot-end-marker
!##### Hostname & Boot - END #####
!
!##### Authentication - START #####
enable secret 5 ${ENABLE_SECRET}
!
username admin privilege 15 secret 5 ${ADMIN_SECRET}
no aaa new-model
!##### Authentication - END #####
!
!##### Platform & Switching - START #####
switch 1 provision ws-c3560cx-12pd-s
system mtu routing 1500
!
ip routing
!
vlan internal allocation policy ascending
!##### Platform & Switching - END #####
!
!##### DNS & Domain - START #####
no ip domain-lookup
ip domain-name $IP_domain_name
ip name-server $IP_dns_address
!##### DNS & Domain - END #####
!
!##### NTP & Clock - START #####
clock timezone $TIMEZONE_NAME $TIMEZONE_OFFSET
clock summer-time $TIMEZONE_DST recurring
!
ntp server $NTP_SERVER_1 prefer
ntp server $NTP_SERVER_2
ntp source Vlan1
!##### NTP & Clock - END #####
!
!##### Spanning Tree - START #####
spanning-tree mode rapid-pvst
spanning-tree extend system-id
spanning-tree portfast default
spanning-tree portfast bpduguard default
spanning-tree loopguard default
spanning-tree vlan 1-4094 priority 4096
!##### Spanning Tree - END #####
!
!##### IP Device Tracking - START #####
ip device tracking probe count 3
ip device tracking probe interval 30
ip device tracking probe delay 10
ip device tracking probe auto-source override
!##### IP Device Tracking - END #####
!
!##### Interfaces - START #####
interface Vlan1
 description LBRUTON.CC
 ip address $VLAN1_address $VLAN1_Subnet
!##### Interfaces - END #####
!
!##### Routing & Forwarding - START #####
ip default-gateway $IP_default_gateway
ip forward-protocol nd
!
no ip http server
no ip http secure-server
!##### Routing & Forwarding - END #####
!
!##### SSH & Remote Access - START #####
ip ssh version 2
ip ssh time-out 60
ip ssh authentication-retries 3
ip ssh logging events
!
ip access-list standard ACL-MGMT
 permit $MGMT_SUBNET $MGMT_WILDCARD
 deny any log
!
line con 0
 exec-timeout 5 0
 logging synchronous
 login local
line vty 0 4
 access-class ACL-MGMT in
 exec-timeout 10 0
 login local
 transport input ssh
 transport output none
line vty 5 15
 access-class ACL-MGMT in
 exec-timeout 10 0
 login local
 transport input ssh
 transport output none
!##### SSH & Remote Access - END #####
!
!##### Logging - START #####
no logging console
logging buffered 32768 informational
logging console errors
logging monitor informational
!
logging source-interface Vlan1
logging host $SYSLOG_HOST transport udp port $SYSLOG_PORT
logging trap informational
!
archive
 log config
  logging enable
  notify syslog contenttype plaintext
  hidekeys
!##### Logging - END #####
!
!##### SNMP - START #####
snmp-server view MONITOR_VIEW iso included
snmp-server group MONITOR_GROUP v3 priv read MONITOR_VIEW
snmp-server user $SNMPV3_USER MONITOR_GROUP v3 auth sha $SNMPV3_AUTH_PASS priv aes 128 $SNMPV3_PRIV_PASS
!
snmp-server location $SNMP_LOCATION
snmp-server contact $SNMP_CONTACT
!
no snmp-server system-shutdown
!##### SNMP - END #####
!
!##### Banner - START #####
banner motd ^C

$MOTD

^C
!##### Banner - END #####
!
!##### Errdisable Recovery - START #####
errdisable recovery cause bpduguard
errdisable recovery cause security-violation
errdisable recovery cause storm-control
errdisable recovery cause arp-inspection
errdisable recovery cause dhcp-rate-limit
errdisable recovery cause link-flap
errdisable recovery interval 300
!##### Errdisable Recovery - END #####
!
end
!##### DEFAULT CONFIGURATION - END #####
```

---

## Variable Summary

All `$variable` / `${variable}` placeholders in this template:

| Variable | Section | Description | Example Value |
|----------|---------|-------------|---------------|
| `$HOSTNAME` | Hostname & Boot | Device hostname | `SW-HOME-01` |
| `${ENABLE_SECRET}` | Authentication | Enable secret (type 5 hash) | `$1$...` |
| `${ADMIN_SECRET}` | Authentication | Admin user secret (type 5 hash) | `$1$...` |
| `$IP_domain_name` | DNS & Domain | DNS domain name | `lbruton.cc` |
| `$IP_dns_address` | DNS & Domain | DNS server IP | `192.168.1.1` |
| `$TIMEZONE_NAME` | NTP & Clock | Timezone abbreviation | `CST` |
| `$TIMEZONE_OFFSET` | NTP & Clock | UTC offset (hours) | `-6` |
| `$TIMEZONE_DST` | NTP & Clock | DST timezone name | `CDT` |
| `$NTP_SERVER_1` | NTP & Clock | Primary NTP server | `0.pool.ntp.org` |
| `$NTP_SERVER_2` | NTP & Clock | Secondary NTP server | `1.pool.ntp.org` |
| `$VLAN1_address` | Interfaces | Management VLAN IP | `192.168.1.10` |
| `$VLAN1_Subnet` | Interfaces | Management subnet mask | `255.255.255.0` |
| `$IP_default_gateway` | Routing & Forwarding | Default gateway IP | `192.168.1.1` |
| `$MGMT_SUBNET` | SSH & Remote Access | Allowed management subnet | `192.168.1.0` |
| `$MGMT_WILDCARD` | SSH & Remote Access | Wildcard mask for ACL | `0.0.0.255` |
| `$SYSLOG_HOST` | Logging | Syslog server IP | `192.168.1.14` |
| `$SYSLOG_PORT` | Logging | Syslog UDP port | `1514` |
| `$SNMPV3_USER` | SNMP | SNMPv3 username | `monitor_user` |
| `$SNMPV3_AUTH_PASS` | SNMP | SNMPv3 auth passphrase | (strong passphrase) |
| `$SNMPV3_PRIV_PASS` | SNMP | SNMPv3 privacy passphrase | (strong passphrase) |
| `$SNMP_LOCATION` | SNMP | Device physical location | `Home Lab Rack` |
| `$SNMP_CONTACT` | SNMP | Admin contact info | `admin@lbruton.cc` |
| `$MOTD` | Banner | Login banner message | `Authorized access only` |

---

## Additional Sections to Consider (Future)

These were not in the original config but are worth adding as optional sections:

### DHCP Snooping (Security)

```ios
!##### DHCP Snooping - START #####
ip dhcp snooping
no ip dhcp snooping information option
ip dhcp snooping vlan 1
ip dhcp snooping database flash:dhcp-snooping-db.txt
!##### DHCP Snooping - END #####
```

Requires per-interface `ip dhcp snooping trust` on uplink ports.

### Dynamic ARP Inspection (Security)

```ios
!##### ARP Inspection - START #####
ip arp inspection vlan 1
ip arp inspection log-buffer logs 32 interval 10
!##### ARP Inspection - END #####
```

Requires DHCP snooping binding table. Trust uplink ports with `ip arp inspection trust`.

### Storm Control (Security)

```ios
!##### Storm Control - START #####
! Applied per-interface on access ports:
! storm-control broadcast level pps 100 80
! storm-control multicast level pps 100 80
! storm-control action trap
!##### Storm Control - END #####
```

### PoE Management

```ios
!##### PoE Management - START #####
power inline police
!
! Per-port examples:
! interface GigabitEthernet0/1
!  power inline auto max 30000
! interface GigabitEthernet0/10
!  power inline never
!##### PoE Management - END #####
```

The 3560CX-12PD-S has a 240W PoE budget. `power inline police` detects overdraw conditions.

---

## Platform Notes

- **Model:** WS-C3560CX-12PD-S (12 PoE+ GbE downlinks, 2x 10G SFP+ uplinks, 240W PoE budget)
- **IOS:** 15.2 (classic IOS, not IOS-XE)
- **Crypto limits:** SHA-1 + AES-128/256 max for SNMPv3 (SHA-256+ requires IOS-XE 16.x+)
- **RSA key:** 2048-bit recommended (4096 possible but slow to generate on this CPU)
- **IPDT:** Auto-activates with dependent features on 15.2(1)E+ — no global enable/disable command
- **CoPP:** Uses `mls qos copp` (not policy-map style used on Cat9K)

---

*Research compiled 2026-03-25 for Forge seed template development.*

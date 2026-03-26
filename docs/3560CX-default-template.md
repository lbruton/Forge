```
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
!##### Hostname & Boot - START #####
hostname $HOSTNAME
!
boot-start-marker
boot-end-marker
!##### Hostname & Boot - END #####
!##### Authentication - START #####
enable secret 5 ${ENABLE_SECRET}
!
username admin privilege 15 secret 5 ${ADMIN_SECRET}
no aaa new-model
!##### Authentication - END #####
!##### Platform & Switching - START #####
switch 1 provision ws-c3560cx-12pd-s
system mtu routing 1500
!
ip routing
!
vlan internal allocation policy ascending
!##### Platform & Switching - END #####
!##### DNS & Domain - START #####
no ip domain-lookup
ip domain-name $IP_domain_name
ip name-server $IP_dns_address
!##### DNS & Domain - END #####
!##### NTP & Clock - START #####
clock timezone $TIMEZONE_NAME $TIMEZONE_OFFSET
clock summer-time $TIMEZONE_DST recurring
!
ntp server $NTP_SERVER_1 prefer
ntp server $NTP_SERVER_2
ntp source Vlan1
!##### NTP & Clock - END #####
!##### Spanning Tree - START #####
spanning-tree mode rapid-pvst
spanning-tree extend system-id
spanning-tree portfast default
spanning-tree portfast bpduguard default
spanning-tree loopguard default
spanning-tree vlan 1-4094 priority 4096
!##### Spanning Tree - END #####
!##### IP Device Tracking - START #####
ip device tracking probe count 3
ip device tracking probe interval 30
ip device tracking probe delay 10
ip device tracking probe auto-source override
!##### IP Device Tracking - END #####
!##### Interfaces - START #####
interface Vlan1
 description LBRUTON.CC
 ip address $VLAN1_address $VLAN1_Subnet
!##### Interfaces - END #####
!##### Routing & Forwarding - START #####
ip default-gateway $IP_default_gateway
ip forward-protocol nd
!
no ip http server
no ip http secure-server
!##### Routing & Forwarding - END #####
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
!##### Banner - START #####
banner motd ^C

$MOTD

^C
!##### Banner - END #####
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

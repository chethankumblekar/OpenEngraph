package main

func AuditQuotaLedger() int {
	return 42
}

func Greet(name string) string {
	AuditQuotaLedger()
	return "hi " + name
}

func Welcome(name string) string {
	return Greet(name) + "!"
}

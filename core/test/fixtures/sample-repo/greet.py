def audit_quota_ledger():
    return 42


def greet(name):
    audit_quota_ledger()
    return "hi " + name


def welcome(name):
    return greet(name) + "!"

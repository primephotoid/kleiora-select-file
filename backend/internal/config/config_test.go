package config

import "testing"

func TestMidtransProductionConfiguration(t *testing.T) {
	c := Config{Environment: "production", MidtransIsProduction: true, MidtransServerKey: "production-key", MidtransBaseURL: "https://api.midtrans.com", MidtransNotificationURL: "https://kleioragrads.com/api/v1/payments/midtrans-notification"}
	if err := c.ValidateMidtrans(); err != nil {
		t.Fatal(err)
	}
	for _, field := range []string{"key", "base", "callback"} {
		bad := c
		switch field {
		case "key":
			bad.MidtransServerKey = ""
		case "base":
			bad.MidtransBaseURL = "https://api.sandbox.midtrans.com"
		case "callback":
			bad.MidtransNotificationURL = "http://kleioragrads.com/api/v1/payments/midtrans-notification"
		}
		if bad.ValidateMidtrans() == nil {
			t.Fatalf("unsafe production %s accepted", field)
		}
	}
}

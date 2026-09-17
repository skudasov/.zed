package fixture

import (
	"testing"
	"time"
)

func TestFlaky(t *testing.T) {
	// ruleid: go-sleep-in-test
	time.Sleep(100 * time.Millisecond)
}

package fx

import "os"

// Store holds things.
type Store struct {
	m map[string]string
}

// Save writes a file.
func Save() error { return os.WriteFile("x", nil, 0o600) }

func (s *Store) Get(key string) (string, bool) {
	v, ok := s.m[key]
	return v, ok
}

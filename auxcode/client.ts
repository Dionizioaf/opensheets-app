// hooks/useOFXParser.ts

export function useOFXParser() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parseFile = async (file: File) => {
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/parse-ofx', {
      method: 'POST',
      body: formData
    });

    const result = await response.json();

    if (!response.ok) {
      setError(result.error);
      setLoading(false);
      return null;
    }

    setLoading(false);
    return result.data;
  };

  return { parseFile, loading, error };
}
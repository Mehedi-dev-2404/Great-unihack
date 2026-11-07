import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, qk } from "@/lib/api";

export function useActionDecision() {
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: qk.reports });
    qc.invalidateQueries({ queryKey: qk.notifications });
    qc.invalidateQueries({ queryKey: qk.pending });
    qc.invalidateQueries({ queryKey: qk.profile });
  };
  const approve = useMutation({
    mutationFn: ({ id, quote }: { id: string; quote?: string }) => api.approve(id, quote),
    onSuccess: refresh,
  });
  const decline = useMutation({ mutationFn: (id: string) => api.decline(id), onSuccess: refresh });
  return { approve, decline };
}

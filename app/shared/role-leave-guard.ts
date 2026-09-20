import { useEffect, useRef } from 'react';

const guards = new Map<symbol, () => string | null>();
let approved = false;
export function approveRoleLeave() { approved = true; }
export function cancelRoleLeave() { approved = false; }
export function roleLeaveWarnings() { return [...guards.values()].map(check => check()).filter((value): value is string => !!value); }
export function useRoleLeaveGuard(active: boolean, message: string) {
  const current = useRef({ active, message }); current.current = { active, message };
  useEffect(() => {
    const id = Symbol('role-leave');
    guards.set(id, () => current.current.active ? current.current.message : null);
    const unload = (event: BeforeUnloadEvent) => {
      if (!approved && current.current.active) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', unload);
    return () => { guards.delete(id); window.removeEventListener('beforeunload', unload); };
  }, []);
}

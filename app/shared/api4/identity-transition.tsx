import React, { type ReactNode } from 'react';
/** Keep visible material in place, but remove its controls from pointer and keyboard interaction. */
export function IdentityRegion({pending,children,className=''}:{pending:boolean;children:ReactNode;className?:string}) {
  return <div className={`ws-identity-region ${className}`} aria-busy={pending} inert={pending}>{children}</div>;
}
export function IdentitySwitchNotice({pending,failed,requestedName,displayedName}:{pending:boolean;failed:boolean;requestedName:string;displayedName:string}) {
  return pending?<p className="ws-switch-notice" role="status">{failed?'Switch not completed:':'Switching to'} {requestedName} · <span>Still showing</span> {displayedName} <span>(read only)</span></p>:null;
}

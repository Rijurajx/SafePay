'use client';

import React, { useMemo, useState, useRef, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import {
  ColDef,
  ModuleRegistry,
  AllCommunityModule,
  themeQuartz,
  GridApi,
  GridReadyEvent,
  ICellRendererParams,
} from 'ag-grid-community';
import {
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Store,
  ShieldAlert,
  User,
  Download,
  RefreshCw,
} from 'lucide-react';

ModuleRegistry.registerModules([AllCommunityModule]);

export interface SafePayApprovalRow {
  id: string;
  paymentRequestId: string;
  elderName: string;
  elderEmail?: string;
  merchantName: string;
  amount: number;
  currency: string;
  category: string;
  status?: string;
  createdAt?: string;
  expiresAt?: string;
  timeoutMinutes?: number;
  riskScore: number;
  riskFactors?: string[];
  explanation?: {
    summary?: string;
    caregiverExplanation?: string;
    seniorExplanation?: string;
    suggestedQuestionsForSenior?: string[];
    riskFactors?: string[];
  } | null;
}

interface SafePayApprovalsGridProps {
  rowData: SafePayApprovalRow[];
  onDecide: (id: string, decision: 'APPROVE' | 'DECLINE') => Promise<void> | void;
  decidingId?: string | null;
  onAnalyzeAi?: (row: SafePayApprovalRow) => void;
}

const approvalsTheme = themeQuartz.withParams({
  accentColor: '#9333ea',
  backgroundColor: '#ffffff',
  borderColor: '#fef3c7',
  borderRadius: 16,
  headerBackgroundColor: '#fffbeb',
  headerTextColor: '#78350f',
  headerFontWeight: 700,
  headerFontSize: 12,
  fontSize: 13,
  rowHoverColor: '#fefce8',
  selectedRowBackgroundColor: '#fef3c7',
});

export function SafePayApprovalsGrid({
  rowData,
  onDecide,
  decidingId = null,
  onAnalyzeAi,
}: SafePayApprovalsGridProps) {
  const gridRef = useRef<AgGridReact<SafePayApprovalRow>>(null);
  const [gridApi, setGridApi] = useState<GridApi<SafePayApprovalRow> | null>(null);
  const [quickFilterText, setQuickFilterText] = useState('');

  const onGridReady = useCallback((params: GridReadyEvent<SafePayApprovalRow>) => {
    setGridApi(params.api);
    params.api.sizeColumnsToFit();
  }, []);

  const handleExportCsv = useCallback(() => {
    if (gridApi) {
      gridApi.exportDataAsCsv({
        fileName: `safepay-pending-approvals-${new Date().toISOString().slice(0, 10)}.csv`,
      });
    }
  }, [gridApi]);

  // Senior Member Cell
  const ElderCellRenderer = (params: ICellRendererParams<SafePayApprovalRow>) => {
    const data = params.data;
    if (!data) return null;
    return (
      <div className="flex items-center gap-2 h-full w-full overflow-hidden">
        <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-[10px] font-bold shrink-0">
          <User className="w-3.5 h-3.5" />
        </div>
        <div className="min-w-0 flex-1 overflow-hidden leading-tight">
          <span className="font-bold text-slate-900 text-xs block truncate">{data.elderName}</span>
          <span className="text-[10px] text-slate-400 block truncate mt-0.5">Protected Senior</span>
        </div>
      </div>
    );
  };

  // Merchant Cell
  const MerchantCellRenderer = (params: ICellRendererParams<SafePayApprovalRow>) => {
    const data = params.data;
    if (!data) return null;
    return (
      <div className="flex items-center gap-2 h-full w-full overflow-hidden">
        <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
          <Store className="w-3.5 h-3.5" />
        </div>
        <div className="min-w-0 flex-1 overflow-hidden leading-tight">
          <span className="font-bold text-slate-900 text-xs block truncate">{data.merchantName}</span>
          <span className="text-[10px] text-slate-400 block truncate mt-0.5">{data.category}</span>
        </div>
      </div>
    );
  };

  // Amount Cell
  const AmountCellRenderer = (params: ICellRendererParams<SafePayApprovalRow>) => {
    const amt = Number(params.value || 0);
    return (
      <div className="flex items-center h-full">
        <span className="font-extrabold text-amber-950 font-mono text-sm">
          ${amt.toFixed(2)}
        </span>
      </div>
    );
  };

  // Risk Score Cell
  const RiskCellRenderer = (params: ICellRendererParams<SafePayApprovalRow>) => {
    const score = Number(params.value ?? 50);
    const isHigh = score >= 70;
    return (
      <div className="flex items-center gap-1.5 h-full">
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
            isHigh ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
          }`}
        >
          <ShieldAlert className="w-3 h-3 shrink-0" />
          <span>{score}/100</span>
        </span>
        <span className="text-[10px] text-slate-500 hidden sm:inline">
          {isHigh ? 'High Risk' : 'Family Hold'}
        </span>
      </div>
    );
  };

  // Actions Cell (Inline Approve / Decline Buttons)
  const ActionsCellRenderer = useCallback((params: ICellRendererParams<SafePayApprovalRow>) => {
    const data = params.data;
    if (!data) return null;
    const isThisDeciding = decidingId === data.id;

    return (
      <div className="flex items-center gap-1.5 h-full py-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDecide(data.id, 'APPROVE');
          }}
          disabled={isThisDeciding}
          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1 shadow-2xs transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
        >
          {isThisDeciding ? (
            <RefreshCw className="w-3 h-3 animate-spin" />
          ) : (
            <CheckCircle2 className="w-3 h-3" />
          )}
          <span>Approve</span>
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onDecide(data.id, 'DECLINE');
          }}
          disabled={isThisDeciding}
          className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold flex items-center gap-1 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
        >
          <XCircle className="w-3 h-3" />
          <span>Decline</span>
        </button>
      </div>
    );
  }, [decidingId, onDecide]);

  const defaultColDef = useMemo<ColDef>(() => {
    return {
      resizable: true,
      sortable: true,
      filter: true,
      cellClass: 'flex items-center',
    };
  }, []);

  const columnDefs = useMemo<ColDef<SafePayApprovalRow>[]>(() => {
    return [
      {
        headerName: 'Senior Member',
        field: 'elderName',
        cellRenderer: ElderCellRenderer,
        flex: 1.2,
        minWidth: 150,
      },
      {
        headerName: 'Merchant & Category',
        field: 'merchantName',
        cellRenderer: MerchantCellRenderer,
        flex: 1.5,
        minWidth: 170,
      },
      {
        headerName: 'Amount',
        field: 'amount',
        cellRenderer: AmountCellRenderer,
        flex: 1,
        minWidth: 110,
        sort: 'desc',
      },
      {
        headerName: 'Risk Evaluation',
        field: 'riskScore',
        cellRenderer: RiskCellRenderer,
        flex: 1.2,
        minWidth: 140,
      },
      {
        headerName: 'Requested At',
        field: 'createdAt',
        flex: 1.2,
        minWidth: 140,
        cellRenderer: (params: ICellRendererParams) => {
          const val = params.value || params.data?.expiresAt;
          if (!val) return null;
          const d = new Date(val);
          return (
            <div className="flex items-center h-full text-xs text-slate-600">
              {d.toLocaleDateString([], { month: 'short', day: 'numeric' })} at{' '}
              {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          );
        },
      },
      {
        headerName: 'Review Decision',
        cellRenderer: ActionsCellRenderer,
        flex: 1.5,
        minWidth: 180,
        sortable: false,
        filter: false,
      },
    ];
  }, [ActionsCellRenderer]);

  return (
    <div className="space-y-3.5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-950">
              {rowData.length} Order{rowData.length > 1 ? 's' : ''} Awaiting Approval
            </h3>
            <p className="text-xs text-slate-500">
              Execute one-click approvals or filter by senior
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-56">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={quickFilterText}
              onChange={(e) => {
                setQuickFilterText(e.target.value);
                if (gridApi) gridApi.setGridOption('quickFilterText', e.target.value);
              }}
              placeholder="Search approvals..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white border border-amber-200 text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>

          <button
            onClick={handleExportCsv}
            title="Export Pending Queue to CSV"
            className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      <div
        className="ag-theme-quartz w-full rounded-2xl overflow-hidden border border-amber-200/90 shadow-xs bg-white"
        style={{ height: rowData.length <= 4 ? `${Math.max(220, rowData.length * 62 + 90)}px` : '360px' }}
      >
        <AgGridReact<SafePayApprovalRow>
          ref={gridRef}
          theme={approvalsTheme}
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          rowHeight={56}
          headerHeight={44}
          pagination={rowData.length > 5}
          paginationPageSize={5}
          rowSelection={{ mode: 'singleRow' }}
          onRowClicked={(e) => e.data && onAnalyzeAi?.(e.data)}
          onGridReady={onGridReady}
        />
      </div>
    </div>
  );
}

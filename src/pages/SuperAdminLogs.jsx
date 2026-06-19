import React, { useState, useEffect } from 'react';
import { useLicense } from '@/lib/LicenseContext';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Mail, Activity, ShieldAlert, FileClock } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function SuperAdminLogs() {
  const { isPlatformAdmin } = useLicense();
  const [emails, setEmails] = useState([]);
  const [versions, setVersions] = useState([]);
  const [changelogEntries, setChangelogEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchLogs = async () => {
    if (!isPlatformAdmin) return;
    setLoading(true);
    setError(null);
    try {
      const [emailsRes, versionsRes, changelogRes] = await Promise.all([
        base44.entities.EmailNotification.list("-created_date", 200),
        base44.entities.AppVersion?.list?.("-created_date", 20) ?? Promise.resolve([]),
        base44.entities.AppChangelog?.list?.("-released_at", 20) ?? Promise.resolve([]),
      ]);
      setEmails(emailsRes);
      setVersions(versionsRes || []);
      setChangelogEntries(changelogRes || []);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [isPlatformAdmin]);

  if (!isPlatformAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <ShieldAlert className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold text-slate-800">Acceso Denegado</h2>
        <p className="text-slate-500 mt-2">Esta página es exclusivamente para el administrador de la plataforma.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center">
            <Activity className="w-8 h-8 mr-3 text-brand-600" />
            Observabilidad del Sistema
          </h1>
          <p className="text-slate-500 mt-1">Logs de automatizaciones, correos y tareas en segundo plano.</p>
        </div>
        <button 
          type="button"
          onClick={fetchLogs} 
          disabled={loading}
          className="flex items-center px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 hover:text-brand-600 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Actualizando...' : 'Actualizar Logs'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-200">
          <strong>Error al cargar logs: </strong> {error}
        </div>
      )}

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
          <CardTitle className="text-lg flex items-center text-slate-800">
            <Mail className="w-5 h-5 mr-2 text-slate-500" />
            Registro de Correos (EmailNotifications)
          </CardTitle>
          <CardDescription>Muestra el estado de envío de los correos automáticos (lifecycle, trials, renewals, etc).</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-[180px]">Fecha</TableHead>
                  <TableHead>Destinatario</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Error / Detalles</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {emails.length === 0 && !loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                      No hay registros de correos en el sistema.
                    </TableCell>
                  </TableRow>
                ) : (
                  emails.map(email => (
                    <TableRow key={email.id} className="group">
                      <TableCell className="text-slate-600 whitespace-nowrap">
                        {(() => {
                          const d = email.created_date ? new Date(email.created_date) : null;
                          return d && !isNaN(d) ? format(d, "dd MMM yyyy, HH:mm", { locale: es }) : "—";
                        })()}
                      </TableCell>
                      <TableCell className="font-medium text-slate-800">{email.recipient_email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-brand-50 text-brand-700 border-brand-200">
                          {email.email_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {email.status === 'sent' && <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Enviado</Badge>}
                        {email.status === 'failed' && <Badge variant="destructive">Fallido</Badge>}
                        {email.status === 'skipped' && <Badge className="bg-slate-100 text-slate-800 hover:bg-slate-100">Omitido</Badge>}
                        {email.status === 'pending' && <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Pendiente</Badge>}
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate text-xs text-slate-500">
                        {email.error_message ? (
                          <span className="text-red-600 font-mono bg-red-50 px-2 py-1 rounded" title={email.error_message}>
                            {email.error_message}
                          </span>
                        ) : email.skip_reason ? (
                          <span className="text-slate-500 italic" title={email.skip_reason}>
                            {email.skip_reason}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
          <CardTitle className="text-lg flex items-center text-slate-800">
            <FileClock className="w-5 h-5 mr-2 text-slate-500" />
            Auditoría nocturna (versión + changelog)
          </CardTitle>
          <CardDescription>
            Aquí se reflejan los resultados diarios de documentación/auditoría (versión en BD y changelog generado).
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-[180px]">Fecha release</TableHead>
                  <TableHead>Versión</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead>Notas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {changelogEntries.length === 0 && versions.length === 0 && !loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                      No hay registros de AppVersion/AppChangelog todavía.
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {changelogEntries.map(entry => (
                      <TableRow key={`changelog-${entry.id}`}>
                        <TableCell className="text-slate-600 whitespace-nowrap">
                          {entry.released_at ? format(new Date(entry.released_at), "dd MMM yyyy, HH:mm", { locale: es }) : '—'}
                        </TableCell>
                        <TableCell className="font-medium text-slate-800">{entry.version || '—'}</TableCell>
                        <TableCell><Badge className="bg-brand-50 text-brand-700 border-brand-200" variant="outline">AppChangelog</Badge></TableCell>
                        <TableCell className="max-w-[460px] truncate text-xs text-slate-500" title={entry.summary || ''}>{entry.summary || '—'}</TableCell>
                      </TableRow>
                    ))}
                    {versions.map(version => (
                      <TableRow key={`version-${version.id}`}>
                        <TableCell className="text-slate-600 whitespace-nowrap">
                          {version.created_date ? format(new Date(version.created_date), "dd MMM yyyy, HH:mm", { locale: es }) : '—'}
                        </TableCell>
                        <TableCell className="font-medium text-slate-800">{version.version || '—'}</TableCell>
                        <TableCell><Badge className="bg-emerald-50 text-emerald-700 border-emerald-200" variant="outline">AppVersion</Badge></TableCell>
                        <TableCell className="max-w-[460px] truncate text-xs text-slate-500" title={version.notes || ''}>{version.notes || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

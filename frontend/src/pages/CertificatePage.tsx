import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  PDFDownloadLink,
} from '@react-pdf/renderer';
import { Download, Share2, ArrowLeft, Award } from 'lucide-react';
import { certificateApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatDate } from '@/lib/utils';
import { Certificate } from '@/types';

// PDF Styles
const styles = StyleSheet.create({
  page: {
    flexDirection: 'row',
    backgroundColor: '#667eea',
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  certificate: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 50,
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  border: {
    position: 'absolute',
    top: 15,
    left: 15,
    right: 15,
    bottom: 15,
    borderWidth: 2,
    borderColor: '#667eea',
    borderRadius: 12,
  },
  scoreBadge: {
    position: 'absolute',
    top: 40,
    right: 60,
    backgroundColor: '#48bb78',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  scoreBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logo: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#667eea',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  title: {
    fontSize: 36,
    color: '#1a202c',
    marginBottom: 4,
  },
  body: {
    alignItems: 'center',
  },
  certifiesText: {
    fontSize: 14,
    color: '#718096',
    marginBottom: 8,
  },
  recipientName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#667eea',
    marginBottom: 16,
    textDecoration: 'underline',
  },
  completedText: {
    fontSize: 14,
    color: '#718096',
    marginBottom: 8,
  },
  courseTitle: {
    fontSize: 20,
    color: '#4a5568',
    fontStyle: 'italic',
    marginBottom: 30,
    textAlign: 'center',
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 20,
    paddingHorizontal: 30,
  },
  detailItem: {
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 9,
    textTransform: 'uppercase',
    color: '#a0aec0',
    letterSpacing: 1,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#2d3748',
  },
  seal: {
    position: 'absolute',
    bottom: 50,
    right: 60,
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#667eea',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sealText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 1.4,
  },
});

function CertificatePDF({ cert }: { cert: Certificate }) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.certificate}>
          <View style={styles.border} />
          <View style={styles.scoreBadge}>
            <Text style={styles.scoreBadgeText}>Score: {cert.score}%</Text>
          </View>
          <View style={styles.header}>
            <Text style={styles.logo}>Train Me Now</Text>
            <Text style={styles.title}>Certificate of Completion</Text>
          </View>
          <View style={styles.body}>
            <Text style={styles.certifiesText}>This certifies that</Text>
            <Text style={styles.recipientName}>{cert.userName}</Text>
            <Text style={styles.completedText}>has successfully completed</Text>
            <Text style={styles.courseTitle}>{cert.courseTitle}</Text>
          </View>
          <View style={styles.detailsRow}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Date</Text>
              <Text style={styles.detailValue}>{formatDate(cert.completionDate)}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Certificate ID</Text>
              <Text style={styles.detailValue}>{cert.certificateNumber}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Awarded By</Text>
              <Text style={styles.detailValue}>Train Me Now</Text>
            </View>
          </View>
          <View style={styles.seal}>
            <Text style={styles.sealText}>{'AI First\nLearning\nAcademy'}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export default function CertificatePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: cert, isLoading, error } = useQuery({
    queryKey: ['certificate', id],
    queryFn: () => certificateApi.get(id!).then(r => r.data as Certificate),
  });

  async function handleShare() {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: 'My Certificate', url });
    } else {
      await navigator.clipboard.writeText(url);
      alert('Link copied to clipboard!');
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 rounded-full bg-primary animate-pulse" />
      </div>
    );
  }

  if (error || !cert) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Certificate not found.</p>
          <Button variant="link" onClick={() => navigate('/')}>Go home</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#667eea] to-[#764ba2]">
      <header className="p-4">
        <button onClick={() => navigate('/')} className="text-white/80 hover:text-white flex items-center gap-1 text-sm">
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </button>
      </header>

      <main className="max-w-3xl mx-auto px-4 pb-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* Certificate preview */}
          <div className="bg-white rounded-2xl shadow-2xl p-12 mb-6 relative overflow-hidden">
            <div className="absolute inset-4 border-2 border-[#667eea] rounded-xl pointer-events-none" />

            <div className="absolute top-8 right-10 bg-green-500 text-white text-xs font-semibold px-4 py-1.5 rounded-full">
              Score: {cert.score}%
            </div>

            <div className="text-center mb-8">
              <div className="text-[#667eea] font-bold tracking-widest uppercase text-lg mb-3">Train Me Now</div>
              <h1 className="font-serif text-4xl text-gray-900">Certificate of Completion</h1>
            </div>

            <div className="text-center mb-8">
              <p className="text-gray-500 mb-2">This certifies that</p>
              <p className="text-3xl font-bold text-[#667eea] underline underline-offset-8 decoration-[#667eea] mb-4">{cert.userName}</p>
              <p className="text-gray-500 mb-2">has successfully completed</p>
              <p className="text-xl text-gray-600 italic">{cert.courseTitle}</p>
            </div>

            <div className="flex justify-around mt-10 pt-6 border-t">
              <div className="text-center">
                <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">Date</p>
                <p className="font-semibold text-gray-700">{formatDate(cert.completionDate)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">Certificate ID</p>
                <p className="font-semibold text-gray-700 text-sm">{cert.certificateNumber}</p>
              </div>
              <div className="text-center">
                <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">Awarded By</p>
                <p className="font-semibold text-gray-700">Train Me Now</p>
              </div>
            </div>

            <div className="absolute bottom-8 right-10 w-20 h-20 rounded-full bg-gradient-to-br from-[#667eea] to-[#764ba2] flex items-center justify-center">
              <Award className="h-8 w-8 text-white" />
            </div>
          </div>

          {/* Actions */}
          <Card>
            <CardContent className="pt-6 flex flex-wrap gap-3 justify-center">
              {(() => {
                // PDFDownloadLink's TS types don't expose the render-prop overload cleanly
                const PDFLink = PDFDownloadLink as unknown as React.FC<{
                  document: React.ReactElement;
                  fileName: string;
                  children: (props: { loading: boolean }) => React.ReactElement;
                }>;
                return (
                  <PDFLink
                    document={<CertificatePDF cert={cert} />}
                    fileName={`certificate-${cert.certificateNumber}.pdf`}
                  >
                    {({ loading }) => (
                      <Button disabled={loading}>
                        <Download className="h-4 w-4 mr-2" />
                        {loading ? 'Preparing PDF...' : 'Download PDF'}
                      </Button>
                    )}
                  </PDFLink>
                );
              })()}

              <Button variant="outline" onClick={handleShare}>
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>

              <Button variant="ghost" onClick={() => navigate('/')}>
                Back to Dashboard
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}

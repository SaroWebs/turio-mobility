import React, { useState, useEffect } from 'react';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/ModernCard';
import { Badge, Button, Card} from '@mantine/core';

import { 
  Shield, 
  Plus, 
  FileText, 
  DollarSign, 
  Calendar, 
  AlertTriangle,
  CheckCircle,
  XCircle 
} from 'lucide-react';

interface InsurancePolicy {
  id: number;
  policy_number: string;
  insurance_type: string;
  coverage_amount: number;
  premium_amount: number;
  start_date: string;
  end_date: string;
  status: string;
  payment_status: string;
  claims: Claim[];
}

interface Claim {
  id: number;
  claim_number: string;
  incident_date: string;
  incident_description: string;
  claim_amount: number;
  status: string;
}

interface PolicySummaryProps {
  policies: InsurancePolicy[];
}

const PolicySummary: React.FC<{ policies: InsurancePolicy[] }> = ({ policies }) => {
  const activePolicies = policies.filter(p => p.status === 'active');
  const totalCoverage = activePolicies.reduce((sum, p) => sum + p.coverage_amount, 0);
  const totalPremium = activePolicies.reduce((sum, p) => sum + p.premium_amount, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Policy Summary</span>
          <Button variant="outline" size="sm" onClick={() => {}}>
            <Plus className="mr-2 h-4 w-4" />
            Add Policy
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="text-center p-4 bg-blue-50 rounded-lg">
          <Shield className="mx-auto h-8 w-8 text-blue-600 mb-2" />
          <div className="text-2xl font-bold text-blue-900">{activePolicies.length}</div>
          <div className="text-sm text-blue-600">Active Policies</div>
        </div>
        <div className="text-center p-4 bg-green-50 rounded-lg">
          <DollarSign className="mx-auto h-8 w-8 text-green-600 mb-2" />
          <div className="text-2xl font-bold text-green-900">₹{totalCoverage.toLocaleString()}</div>
          <div className="text-sm text-green-600">Total Coverage</div>
        </div>
        <div className="text-center p-4 bg-purple-50 rounded-lg">
          <Calendar className="mx-auto h-8 w-8 text-purple-600 mb-2" />
          <div className="text-2xl font-bold text-purple-900">₹{totalPremium.toLocaleString()}</div>
          <div className="text-sm text-purple-600">Total Premium</div>
        </div>
      </CardContent>
    </Card>
  );
};

const RecentClaims: React.FC<{ claims: Claim[] }> = ({ claims }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'paid': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <AlertTriangle className="h-4 w-4" />;
      case 'approved': return <CheckCircle className="h-4 w-4" />;
      case 'rejected': return <XCircle className="h-4 w-4" />;
      case 'paid': return <CheckCircle className="h-4 w-4" />;
      default: return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Claims</CardTitle>
      </CardHeader>
      <CardContent>
        {claims.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No claims found
          </div>
        ) : (
          <div className="space-y-4">
            {claims.slice(0, 5).map((claim) => (
              <div key={claim.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="p-2 bg-gray-100 rounded-full">
                    {getStatusIcon(claim.status)}
                  </div>
                  <div>
                    <div className="font-semibold">{claim.claim_number}</div>
                    <div className="text-sm text-gray-600">{claim.incident_description}</div>
                    <div className="text-xs text-gray-500">Incident Date: {new Date(claim.incident_date).toLocaleDateString()}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">₹{claim.claim_amount.toLocaleString()}</div>
                  <Badge className={getStatusColor(claim.status)}>
                    {claim.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const InsuranceCalculator: React.FC = () => {
  const [formData, setFormData] = useState({
    vehicleType: 'car',
    coverageType: 'comprehensive',
    sumInsured: 500000,
    tenure: 1
  });

  const calculatePremium = () => {
    let baseRate = 0;
    
    if (formData.coverageType === 'comprehensive') baseRate = 0.04;
    else if (formData.coverageType === 'third_party') baseRate = 0.02;
    else if (formData.coverageType === 'personal_accident') baseRate = 0.01;

    return formData.sumInsured * baseRate * formData.tenure;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Insurance Calculator</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Type</label>
            <select 
              value={formData.vehicleType} 
              onChange={(e) => setFormData({...formData, vehicleType: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="car">Car</option>
              <option value="bike">Bike</option>
              <option value="commercial">Commercial Vehicle</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Coverage Type</label>
            <select 
              value={formData.coverageType} 
              onChange={(e) => setFormData({...formData, coverageType: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="comprehensive">Comprehensive</option>
              <option value="third_party">Third Party</option>
              <option value="personal_accident">Personal Accident</option>
            </select>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sum Insured (₹)</label>
            <input 
              type="number" 
              value={formData.sumInsured} 
              onChange={(e) => setFormData({...formData, sumInsured: parseInt(e.target.value)})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tenure (Years)</label>
            <select 
              value={formData.tenure} 
              onChange={(e) => setFormData({...formData, tenure: parseInt(e.target.value)})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={1}>1 Year</option>
              <option value={2}>2 Years</option>
              <option value={3}>3 Years</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Premium</label>
            <div className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-md text-blue-900 font-semibold">
              ₹{calculatePremium().toLocaleString()}
            </div>
          </div>
        </div>
        
        <Button className="w-full bg-blue-600 hover:bg-blue-700">
          <FileText className="mr-2 h-4 w-4" />
          Get Quote
        </Button>
      </CardContent>
    </Card>
  );
};

const InsuranceDashboard: React.FC = () => {
  const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch policies and claims
    const fetchInsuranceData = async () => {
      try {
        // Mock data for now - replace with actual API calls
        const mockPolicies: InsurancePolicy[] = [
          {
            id: 1,
            policy_number: 'POL-2025-000001',
            insurance_type: 'comprehensive',
            coverage_amount: 500000,
            premium_amount: 20000,
            start_date: '2025-01-01',
            end_date: '2026-01-01',
            status: 'active',
            payment_status: 'paid',
            claims: []
          }
        ];

        const mockClaims: Claim[] = [
          {
            id: 1,
            claim_number: 'CLM-2025-000001',
            incident_date: '2025-12-15',
            incident_description: 'Minor collision at intersection',
            claim_amount: 15000,
            status: 'pending'
          }
        ];

        setPolicies(mockPolicies);
        setClaims(mockClaims);
      } catch (error) {
        console.error('Error fetching insurance data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchInsuranceData();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Insurance Management</h1>
        <Button onClick={() => {}}>
          <Plus className="mr-2 h-4 w-4" />
          New Policy
        </Button>
      </div>
      
      <PolicySummary policies={policies} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentClaims claims={claims} />
        <InsuranceCalculator />
      </div>
    </div>
  );
};

export default InsuranceDashboard;
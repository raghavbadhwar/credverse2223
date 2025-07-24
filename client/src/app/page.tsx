import Link from 'next/link';
import { 
  AcademicCapIcon, 
  ShieldCheckIcon, 
  GlobeAltIcon, 
  CubeTransparentIcon,
  UserGroupIcon,
  DocumentCheckIcon 
} from '@heroicons/react/24/outline';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <CubeTransparentIcon className="h-8 w-8 text-primary-600" />
              <span className="ml-2 text-xl font-bold text-gray-900">CredVerse</span>
            </div>
            <div className="flex items-center space-x-4">
              <Link 
                href="/verify" 
                className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                Verify Credential
              </Link>
              <Link 
                href="/auth/login" 
                className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                Sign In
              </Link>
              <Link 
                href="/auth/register" 
                className="btn-primary"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
              The Future of
              <span className="text-gradient block">Digital Credentials</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Issue, verify, and manage educational credentials using blockchain technology 
              and W3C Verifiable Credentials. Secure, tamper-proof, and globally accessible.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/auth/register?role=institution" className="btn-primary text-lg px-8 py-3">
                For Institutions
              </Link>
              <Link href="/auth/register?role=student" className="btn-secondary text-lg px-8 py-3">
                For Students
              </Link>
              <Link href="/verify" className="btn-secondary text-lg px-8 py-3">
                Verify Credentials
              </Link>
            </div>
          </div>
        </div>

        {/* Background decoration */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-96 h-96 bg-gradient-to-r from-primary-400 to-purple-400 rounded-full opacity-10 blur-3xl"></div>
          <div className="absolute bottom-0 right-0 w-80 h-80 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full opacity-10 blur-3xl"></div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Powerful Features for Everyone
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Our platform provides comprehensive tools for institutions, students, and verifiers 
              to manage digital credentials securely and efficiently.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="card text-center p-8">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-primary-100 rounded-lg mb-4">
                <AcademicCapIcon className="h-6 w-6 text-primary-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Institutional Dashboard
              </h3>
              <p className="text-gray-600">
                Issue credentials, manage students, track verification statistics, 
                and maintain your institution's credibility on the blockchain.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="card text-center p-8">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-lg mb-4">
                <ShieldCheckIcon className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Secure Verification
              </h3>
              <p className="text-gray-600">
                Instantly verify credentials using QR codes, blockchain records, 
                and cryptographic proofs. No more fake certificates.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="card text-center p-8">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-purple-100 rounded-lg mb-4">
                <GlobeAltIcon className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Global Standards
              </h3>
              <p className="text-gray-600">
                Built on W3C Verifiable Credentials standards and powered by 
                Polygon blockchain for worldwide interoperability.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="card text-center p-8">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg mb-4">
                <UserGroupIcon className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Student Wallet
              </h3>
              <p className="text-gray-600">
                Store all your credentials in a secure digital wallet. 
                Share them easily and maintain full control over your data.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="card text-center p-8">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-yellow-100 rounded-lg mb-4">
                <DocumentCheckIcon className="h-6 w-6 text-yellow-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Batch Issuance
              </h3>
              <p className="text-gray-600">
                Issue hundreds of credentials at once using CSV upload. 
                Perfect for graduation ceremonies and bulk operations.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="card text-center p-8">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-red-100 rounded-lg mb-4">
                <CubeTransparentIcon className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                IPFS Storage
              </h3>
              <p className="text-gray-600">
                Credential metadata stored on IPFS for decentralized access 
                and permanent availability without central control.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              How CredVerse Works
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Simple steps to issue, manage, and verify digital credentials
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 text-white rounded-full text-xl font-bold mb-4">
                1
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Institution Registers
              </h3>
              <p className="text-gray-600">
                Educational institutions register and get verified by our admin team 
                to ensure credibility and authenticity.
              </p>
            </div>

            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 text-white rounded-full text-xl font-bold mb-4">
                2
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Credentials Issued
              </h3>
              <p className="text-gray-600">
                Institutions issue verifiable credentials to students, 
                which are stored on blockchain and IPFS for permanence.
              </p>
            </div>

            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 text-white rounded-full text-xl font-bold mb-4">
                3
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Instant Verification
              </h3>
              <p className="text-gray-600">
                Anyone can verify credentials instantly using QR codes or 
                credential IDs. No intermediaries required.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-primary-600 to-purple-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Join thousands of institutions and students already using CredVerse 
            to issue and verify digital credentials.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/auth/register?role=institution" 
              className="inline-flex items-center justify-center px-8 py-3 border border-transparent text-lg font-medium rounded-md text-primary-600 bg-white hover:bg-gray-50 transition-colors duration-200"
            >
              Register Institution
            </Link>
            <Link 
              href="/verify" 
              className="inline-flex items-center justify-center px-8 py-3 border-2 border-white text-lg font-medium rounded-md text-white hover:bg-white hover:text-primary-600 transition-colors duration-200"
            >
              Verify Credential
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center mb-4">
                <CubeTransparentIcon className="h-8 w-8 text-primary-400" />
                <span className="ml-2 text-xl font-bold">CredVerse</span>
              </div>
              <p className="text-gray-400 mb-4 max-w-md">
                The future of digital credentials. Secure, verifiable, and globally accessible 
                educational certificates powered by blockchain technology.
              </p>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-4">Platform</h3>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/verify" className="hover:text-white">Verify Credentials</Link></li>
                <li><Link href="/auth/register" className="hover:text-white">Get Started</Link></li>
                <li><Link href="/docs" className="hover:text-white">Documentation</Link></li>
                <li><Link href="/api" className="hover:text-white">API</Link></li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/about" className="hover:text-white">About</Link></li>
                <li><Link href="/contact" className="hover:text-white">Contact</Link></li>
                <li><Link href="/privacy" className="hover:text-white">Privacy</Link></li>
                <li><Link href="/terms" className="hover:text-white">Terms</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2024 CredVerse. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged 
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

export function useAdminAuth() {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsubscribe = firebaseOnAuthStateChanged(auth, async (user) => {
      if (user && !user.isAnonymous) {
        try {
          const adminStatus = await checkAdminStatus(user);
          if (adminStatus.isAdmin) {
            setAdmin(adminStatus.adminData);
            setIsAdmin(true);
          } else {
            setAdmin(null);
            setIsAdmin(false);
            setError('Access denied: Admin privileges required');
          }
        } catch (error) {
          console.error('Admin status check failed:', error);
          setAdmin(null);
          setIsAdmin(false);
          setError(error.message);
        }
      } else {
        setAdmin(null);
        setIsAdmin(false);
        setError(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const checkAdminStatus = async (user) => {
    try {
      const adminRef = doc(db, 'admin_users', user.uid);
      const adminDoc = await getDoc(adminRef);
      
      if (adminDoc.exists() && adminDoc.data().isAdmin === true) {
        const adminData = {
          uid: user.uid,
          email: user.email,
          ...adminDoc.data()
        };
        
        await updateAdminLogin(user.uid);
        return { isAdmin: true, adminData };
      } else {
        return { isAdmin: false, adminData: null };
      }
    } catch (error) {
      console.error('Failed to check admin status:', error);
      throw error;
    }
  };

  const updateAdminLogin = async (adminId) => {
    try {
      const adminRef = doc(db, 'admin_users', adminId);
      await updateDoc(adminRef, {
        lastLogin: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Failed to update admin login:', error);
    }
  };

  const signIn = useCallback(async (email, password) => {
    try {
      setLoading(true);
      setError(null);

      const credential = await signInWithEmailAndPassword(auth, email, password);
      const adminStatus = await checkAdminStatus(credential.user);
      
      if (!adminStatus.isAdmin) {
        await firebaseSignOut(auth);
        throw new Error('Access denied: Admin privileges required');
      }

      console.log('Admin authentication successful:', credential.user.email);
      
      return {
        success: true,
        admin: adminStatus.adminData,
        isAdmin: true
      };

    } catch (error) {
      console.error('Admin login failed:', error);
      setError(error.message);
      throw new Error(`Login failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await firebaseSignOut(auth);
      setAdmin(null);
      setIsAdmin(false);
      setError(null);
      console.log('Admin signed out');
    } catch (error) {
      console.error('Admin sign out failed:', error);
      setError(error.message);
      throw error;
    }
  }, []);

  const createAdmin = useCallback(async (email, password, permissions = []) => {
    if (!isAdmin) {
      throw new Error('Only existing admins can create new admin accounts');
    }

    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      
      await setDoc(doc(db, 'admin_users', credential.user.uid), {
        email: email,
        isAdmin: true,
        permissions: permissions.length > 0 ? permissions : [
          'manage_lotteries',
          'approve_prizes', 
          'system_config',
          'user_management'
        ],
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
        createdBy: admin?.uid || 'system'
      });

      console.log('Admin account created:', email);
      return credential.user;

    } catch (error) {
      console.error('Failed to create admin account:', error);
      throw error;
    }
  }, [isAdmin, admin]);

  const hasPermission = useCallback((permission) => {
    return isAdmin && 
           admin && 
           admin.permissions && 
           admin.permissions.includes(permission);
  }, [isAdmin, admin]);

  const updatePermissions = useCallback(async (adminId, newPermissions) => {
    if (!hasPermission('user_management')) {
      throw new Error('Insufficient permissions to update admin permissions');
    }

    try {
      const adminRef = doc(db, 'admin_users', adminId);
      await updateDoc(adminRef, {
        permissions: newPermissions,
        updatedAt: serverTimestamp(),
        updatedBy: admin.uid
      });

      console.log('Admin permissions updated:', adminId);
      return true;
    } catch (error) {
      console.error('Failed to update admin permissions:', error);
      throw error;
    }
  }, [hasPermission, admin]);

  const getAdminList = useCallback(async () => {
    if (!hasPermission('user_management')) {
      throw new Error('Insufficient permissions to view admin list');
    }

    try {
      const adminSnapshot = await getDocs(collection(db, 'admin_users'));
      const adminList = [];
      
      adminSnapshot.forEach(doc => {
        adminList.push({ id: doc.id, ...doc.data() });
      });

      return adminList;
    } catch (error) {
      console.error('Failed to get admin list:', error);
      throw error;
    }
  }, [hasPermission]);

  const logAdminAction = useCallback(async (action, details = {}) => {
    if (!isAdmin) return;

    try {
      await addDoc(collection(db, 'admin_logs'), {
        adminId: admin.uid,
        adminEmail: admin.email,
        action,
        details,
        timestamp: serverTimestamp(),
        ipAddress: null, // This would need to be captured from the client
        userAgent: navigator.userAgent
      });
    } catch (error) {
      console.error('Failed to log admin action:', error);
    }
  }, [isAdmin, admin]);

  return {
    admin,
    loading,
    isAdmin,
    error,
    signIn,
    signOut,
    createAdmin,
    hasPermission,
    updatePermissions,
    getAdminList,
    logAdminAction
  };
}

export default useAdminAuth;

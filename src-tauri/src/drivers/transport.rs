use hidapi::{HidDevice, HidError};
use std::{thread, time::Duration};

/// Native HID boundary. Buffers follow hidapi conventions, including report IDs.
pub trait HidTransport {
    fn send_feature_report(&self, data: &[u8]) -> Result<(), HidError>;
    fn get_feature_report(&self, data: &mut [u8]) -> Result<usize, HidError>;
    fn write(&self, data: &[u8]) -> Result<usize, HidError>;
    fn read_timeout(&self, data: &mut [u8], timeout: i32) -> Result<usize, HidError>;
    fn delay(&self, milliseconds: u64) {
        thread::sleep(Duration::from_millis(milliseconds));
    }
}

impl HidTransport for HidDevice {
    fn send_feature_report(&self, data: &[u8]) -> Result<(), HidError> {
        HidDevice::send_feature_report(self, data)
    }
    fn get_feature_report(&self, data: &mut [u8]) -> Result<usize, HidError> {
        HidDevice::get_feature_report(self, data)
    }
    fn write(&self, data: &[u8]) -> Result<usize, HidError> {
        HidDevice::write(self, data)
    }
    fn read_timeout(&self, data: &mut [u8], timeout: i32) -> Result<usize, HidError> {
        HidDevice::read_timeout(self, data, timeout)
    }
}

#[cfg(test)]
pub mod mock {
    use super::*;
    use std::{
        cell::{Cell, RefCell},
        collections::VecDeque,
    };

    #[derive(Debug, PartialEq)]
    pub enum Event {
        Feature(Vec<u8>),
        Output(Vec<u8>),
        Delay(u64),
        ReceiveFeature(u8),
        ReceiveInput(i32),
    }

    /// Queue-driven mock: unexpected reads and oversize replies fail explicitly.
    #[derive(Default)]
    pub struct MockTransport {
        pub events: RefCell<Vec<Event>>,
        pub feature: RefCell<VecDeque<Vec<u8>>>,
        pub input: RefCell<VecDeque<Vec<u8>>>,
        pub fail_next_send: RefCell<Option<String>>,
        pub short_write: Cell<bool>,
    }

    fn receive(queue: &RefCell<VecDeque<Vec<u8>>>, data: &mut [u8]) -> Result<usize, HidError> {
        let reply = queue
            .borrow_mut()
            .pop_front()
            .ok_or_else(|| HidError::HidApiError {
                message: "Mock response queue exhausted".into(),
            })?;
        if reply.len() > data.len() {
            return Err(HidError::HidApiError {
                message: "Mock response exceeds buffer".into(),
            });
        }
        data[..reply.len()].copy_from_slice(&reply);
        Ok(reply.len())
    }

    impl HidTransport for MockTransport {
        fn send_feature_report(&self, data: &[u8]) -> Result<(), HidError> {
            self.events.borrow_mut().push(Event::Feature(data.to_vec()));
            if let Some(message) = self.fail_next_send.borrow_mut().take() {
                return Err(HidError::HidApiError { message });
            }
            Ok(())
        }
        fn get_feature_report(&self, data: &mut [u8]) -> Result<usize, HidError> {
            self.events
                .borrow_mut()
                .push(Event::ReceiveFeature(data[0]));
            receive(&self.feature, data)
        }
        fn write(&self, data: &[u8]) -> Result<usize, HidError> {
            self.events.borrow_mut().push(Event::Output(data.to_vec()));
            if let Some(message) = self.fail_next_send.borrow_mut().take() {
                return Err(HidError::HidApiError { message });
            }
            Ok(if self.short_write.get() {
                data.len() - 1
            } else {
                data.len()
            })
        }
        fn read_timeout(&self, data: &mut [u8], timeout: i32) -> Result<usize, HidError> {
            self.events.borrow_mut().push(Event::ReceiveInput(timeout));
            receive(&self.input, data)
        }
        fn delay(&self, milliseconds: u64) {
            self.events.borrow_mut().push(Event::Delay(milliseconds));
        }
    }
}
